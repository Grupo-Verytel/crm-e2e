import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { QueryTypes, type Transaction } from 'sequelize';
import { GraphClientService } from '../../graph-integration/services/graph-client.service';
import {
  OUTLOOK_CANDIDATE_SQL,
  OUTLOOK_CONTEXT_SQL,
  OUTLOOK_LOCK_SQL,
  OUTLOOK_MAILBOX_FORBIDDEN,
  OUTLOOK_UNAUTHORIZED_TENANT,
  buildOutlookEvent,
  describeGraphFailure,
  isAuthorizedMailbox,
  readOutlookSyncConfig,
  retryAfterDelayMs,
  truncateOutlookError,
  type OutlookSyncSettings,
} from '../lib/outlook-sync';
import { OutlookSyncStatus } from '../models/enums/outlook-sync-status.enum';
import { ReminderStatus } from '../models/enums/reminder-status.enum';
import { Reminder } from '../models/reminder.model';

type CycleStep = { stop: boolean; pauseMs: number };

type ContextRow = {
  email: string;
  titulo: string;
  ouv_id: string;
  consecutivo: string;
};

type OutlookPatch = {
  outlookEventId?: string | null;
  outlookSyncStatus?: OutlookSyncStatus;
  outlookSyncAttempts?: number;
  outlookSyncedAt?: Date;
  outlookLastError?: string | null;
};

const CONTINUE: CycleStep = { stop: false, pauseMs: 0 };

/**
 * Creates and deletes Outlook events for OUV reminders only.
 * Lead and SQL rows stay NOT_REQUIRED and are excluded by ouv_interaction_id.
 * One reminder is locked, sent to Graph and updated inside its own transaction.
 */
@Injectable()
export class OutlookReminderSyncService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(OutlookReminderSyncService.name);
  private readonly settings: OutlookSyncSettings;
  private timer: ReturnType<typeof setInterval> | null = null;
  private cycling = false;
  private pauseUntil = 0;

  constructor(
    @InjectModel(Reminder) private readonly reminderModel: typeof Reminder,
    private readonly graph: GraphClientService,
    configService: ConfigService,
  ) {
    this.settings = readOutlookSyncConfig(configService);
  }

  onModuleInit(): void {
    if (!this.settings.enabled) {
      this.logger.log('outlook sync disabled');
      return;
    }
    this.timer = setInterval(() => {
      void this.runCycle();
    }, this.settings.intervalMs);
    this.timer.unref?.();
    this.logger.log(`outlook sync every ${this.settings.intervalMs}ms`);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runCycle(): Promise<void> {
    if (!this.settings.enabled || this.cycling) {
      return;
    }
    if (Date.now() < this.pauseUntil) {
      return;
    }
    this.cycling = true;
    try {
      const ids = await this.listCandidateIds();
      for (const reminderId of ids) {
        const step = await this.processOne(reminderId);
        if (step.stop) {
          if (step.pauseMs > 0) {
            this.pauseUntil = Date.now() + step.pauseMs;
          }
          this.logger.warn(
            `outlook sync cycle stopped after 429 pauseMs=${step.pauseMs}`,
          );
          break;
        }
      }
    } finally {
      this.cycling = false;
    }
  }

  private async listCandidateIds(): Promise<string[]> {
    const rows = await this.sequelize().query<{ reminder_id: string }>(
      OUTLOOK_CANDIDATE_SQL,
      {
        replacements: { maxAttempts: this.settings.maxAttempts },
        type: QueryTypes.SELECT,
      },
    );
    return rows.map((row) => row.reminder_id);
  }

  private async processOne(reminderId: string): Promise<CycleStep> {
    try {
      return await this.sequelize().transaction((transaction) =>
        this.syncLocked(reminderId, transaction),
      );
    } catch {
      this.logger.error(`outlook sync ${reminderId} transaction failed`);
      return CONTINUE;
    }
  }

  private async syncLocked(
    reminderId: string,
    transaction: Transaction,
  ): Promise<CycleStep> {
    const locked = await this.sequelize().query<{ reminder_id: string }>(
      OUTLOOK_LOCK_SQL,
      {
        replacements: {
          reminderId,
          maxAttempts: this.settings.maxAttempts,
        },
        transaction,
        type: QueryTypes.SELECT,
      },
    );
    if (!locked[0]) {
      return CONTINUE;
    }

    const reminder = await this.reminderModel.findByPk(reminderId, {
      transaction,
    });
    if (!reminder || reminder.completedAt) {
      return CONTINUE;
    }

    if (
      reminder.status === ReminderStatus.Cancelado &&
      !reminder.outlookEventId
    ) {
      await this.write(
        reminder,
        {
          outlookSyncStatus: OutlookSyncStatus.NotRequired,
          outlookLastError: null,
        },
        transaction,
      );
      this.logger.log(
        `outlook sync ${reminderId} action=skip-cancel result=not-required`,
      );
      return CONTINUE;
    }

    if (
      reminder.outlookEventId &&
      (reminder.status === ReminderStatus.Pendiente ||
        reminder.status === ReminderStatus.Enviado)
    ) {
      await this.write(
        reminder,
        {
          outlookEventId: reminder.outlookEventId,
          outlookSyncStatus: OutlookSyncStatus.Synced,
          outlookSyncedAt: new Date(),
          outlookLastError: null,
        },
        transaction,
      );
      this.logger.log(`outlook sync ${reminderId} action=heal result=synced`);
      return CONTINUE;
    }

    const context = await this.loadContext(reminderId, transaction);
    const email = context?.email?.trim() ?? '';
    if (!isAuthorizedMailbox(email)) {
      await this.failPermanent(
        reminder,
        OUTLOOK_UNAUTHORIZED_TENANT,
        transaction,
      );
      this.logger.warn(
        `outlook sync ${reminderId} action=reject result=unauthorized-domain`,
      );
      return CONTINUE;
    }

    if (
      reminder.status === ReminderStatus.Cancelado &&
      reminder.outlookEventId
    ) {
      return this.deleteEvent(reminder, email, transaction);
    }

    if (
      reminder.status !== ReminderStatus.Pendiente &&
      reminder.status !== ReminderStatus.Enviado
    ) {
      return CONTINUE;
    }

    if (!context?.ouv_id || !context.consecutivo || !this.settings.publicUrl) {
      return this.failRetryable(
        reminder,
        'No se encontró la OUV del recordatorio',
        transaction,
      );
    }

    return this.createEvent(reminder, email, context, transaction);
  }

  private async createEvent(
    reminder: Reminder,
    email: string,
    context: ContextRow,
    transaction: Transaction,
  ): Promise<CycleStep> {
    const data = buildOutlookEvent({
      reminderId: reminder.reminderId,
      consecutivo: context.consecutivo,
      titulo: context.titulo ?? '',
      note: reminder.note,
      eventAt: new Date(reminder.eventAt),
      remindDaysBefore: reminder.remindDaysBefore,
      ouvId: context.ouv_id,
      publicUrl: this.settings.publicUrl ?? '',
    });
    try {
      const created = await this.graph.request<{ id?: string }>(
        'POST',
        `/users/${encodeURIComponent(email)}/events`,
        { data },
      );
      if (!created?.id) {
        return this.failRetryable(
          reminder,
          'Graph no devolvió el id del evento',
          transaction,
        );
      }
      await this.write(
        reminder,
        {
          outlookEventId: created.id,
          outlookSyncStatus: OutlookSyncStatus.Synced,
          outlookSyncedAt: new Date(),
          outlookLastError: null,
        },
        transaction,
      );
      this.logger.log(
        `outlook sync ${reminder.reminderId} action=create result=synced`,
      );
      return CONTINUE;
    } catch (error) {
      return this.recordFailure(reminder, error, transaction, 'create');
    }
  }

  private async deleteEvent(
    reminder: Reminder,
    email: string,
    transaction: Transaction,
  ): Promise<CycleStep> {
    const eventId = reminder.outlookEventId;
    if (!eventId) {
      return CONTINUE;
    }
    try {
      await this.graph.request(
        'DELETE',
        `/users/${encodeURIComponent(email)}/events/${encodeURIComponent(eventId)}`,
      );
    } catch (error) {
      const failure = describeGraphFailure(error);
      if (failure.status === 404) {
        await this.clearEvent(reminder, transaction);
        this.logger.log(
          `outlook sync ${reminder.reminderId} action=delete result=missing`,
        );
        return CONTINUE;
      }
      return this.recordFailure(reminder, error, transaction, 'delete');
    }
    await this.clearEvent(reminder, transaction);
    this.logger.log(
      `outlook sync ${reminder.reminderId} action=delete result=deleted`,
    );
    return CONTINUE;
  }

  private async recordFailure(
    reminder: Reminder,
    error: unknown,
    transaction: Transaction,
    action: 'create' | 'delete',
  ): Promise<CycleStep> {
    const failure = describeGraphFailure(error);
    this.logger.warn(
      `outlook sync ${reminder.reminderId} action=${action} result=failed status=${failure.status}`,
    );
    if (failure.status === 429) {
      await this.write(
        reminder,
        {
          outlookLastError: truncateOutlookError(
            failure.message || 'Microsoft Graph respondió 429',
          ),
        },
        transaction,
      );
      return {
        stop: true,
        pauseMs: retryAfterDelayMs(failure.retryAfter),
      };
    }
    if (failure.status === 403 || failure.status === 404) {
      await this.failPermanent(
        reminder,
        `${OUTLOOK_MAILBOX_FORBIDDEN} (${failure.status})`,
        transaction,
      );
      return CONTINUE;
    }
    return this.failRetryable(reminder, failure.message, transaction);
  }

  private async failPermanent(
    reminder: Reminder,
    message: string,
    transaction: Transaction,
  ): Promise<void> {
    await this.write(
      reminder,
      {
        outlookSyncStatus: OutlookSyncStatus.Failed,
        outlookSyncAttempts: this.settings.maxAttempts,
        outlookLastError: truncateOutlookError(message),
      },
      transaction,
    );
  }

  private async failRetryable(
    reminder: Reminder,
    message: string,
    transaction: Transaction,
  ): Promise<CycleStep> {
    await this.write(
      reminder,
      {
        outlookSyncStatus: OutlookSyncStatus.Failed,
        outlookSyncAttempts: reminder.outlookSyncAttempts + 1,
        outlookLastError: truncateOutlookError(message),
      },
      transaction,
    );
    return CONTINUE;
  }

  private async clearEvent(
    reminder: Reminder,
    transaction: Transaction,
  ): Promise<void> {
    await this.write(
      reminder,
      {
        outlookEventId: null,
        outlookSyncStatus: OutlookSyncStatus.NotRequired,
        outlookSyncedAt: new Date(),
        outlookLastError: null,
      },
      transaction,
    );
  }

  private async loadContext(
    reminderId: string,
    transaction: Transaction,
  ): Promise<ContextRow | null> {
    const rows = await this.sequelize().query<ContextRow>(OUTLOOK_CONTEXT_SQL, {
      replacements: { reminderId },
      transaction,
      type: QueryTypes.SELECT,
    });
    return rows[0] ?? null;
  }

  private async write(
    reminder: Reminder,
    patch: OutlookPatch,
    transaction: Transaction,
  ): Promise<void> {
    await reminder.update(patch, { transaction });
  }

  private sequelize() {
    const connection = this.reminderModel.sequelize;
    if (!connection) {
      throw new Error('Reminder model has no sequelize connection');
    }
    return connection;
  }
}
