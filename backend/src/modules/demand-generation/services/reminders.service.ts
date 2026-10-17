import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { literal, Op, QueryTypes } from 'sequelize';
import { bogotaDayEnd } from '../../../common/time/bogota-day';
import { EntityType } from '../../workflow-engine/enums/entity-type.enum';
import { Notification } from '../../workflow-engine/models/notification.model';
import {
  NOTIFICATION_PUSH_PORT,
  type NotificationPushPort,
} from '../../workflow-engine/side-effects/notification-push.port';
import { DEMAND_GENERATION_ERROR_CODES } from '../constants/demand-generation.constants';
import { CreateReminderDto } from '../dtos/create-reminder.dto';
import { MyRemindersQueryDto } from '../dtos/my-reminders-query.dto';
import {
  MyReminderItemDto,
  PaginatedMyRemindersDto,
} from '../dtos/my-reminders-response.dto';
import {
  ReminderActionResponseDto,
  ReminderResponseDto,
} from '../dtos/reminder-response.dto';
import { buildMyRemindersSql } from '../lib/my-reminders.query';
import { type ReminderGroup } from '../lib/reminder-group';
import { ouvSourceLabel, sqlSourceLabel } from '../lib/reminder-source';
import { OutlookSyncStatus } from '../models/enums/outlook-sync-status.enum';
import { ReminderStatus } from '../models/enums/reminder-status.enum';
import { Interaction } from '../models/interaction.model';
import { Reminder } from '../models/reminder.model';

const DAY_MS = 24 * 60 * 60 * 1000;
const DISPATCH_INTERVAL_MS = 60_000;

/**
 * America/Bogota has no DST (UTC−5), so N calendar days before the same
 * clock time is exactly N × 24 hours.
 */
export function remindAtFromEvent(eventAt: Date, daysBefore: number): Date {
  return new Date(eventAt.getTime() - daysBefore * DAY_MS);
}

type ListedReminder = {
  reminder_id: string;
  reminder_group: ReminderGroup;
};

type ReminderCountRow = {
  overdue: number | string;
  today: number | string;
  upcoming: number | string;
};

@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private dispatching = false;

  constructor(
    @InjectModel(Reminder) private readonly reminderModel: typeof Reminder,
    @InjectModel(Interaction)
    private readonly interactionModel: typeof Interaction,
    @InjectModel(Notification)
    private readonly notificationModel: typeof Notification,
    @Optional()
    @Inject(NOTIFICATION_PUSH_PORT)
    private readonly push?: NotificationPushPort,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.dispatchDue();
    }, DISPATCH_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async createForInteraction(
    interactionId: string,
    userId: string,
    dto: CreateReminderDto,
    scope: { leadId: string },
  ): Promise<ReminderResponseDto> {
    const interaction = await this.interactionModel.findByPk(interactionId);
    if (!interaction || interaction.leadId !== scope.leadId) {
      throw new NotFoundException({
        code: DEMAND_GENERATION_ERROR_CODES.NOT_FOUND,
        message: 'Interaction not found',
      });
    }

    const eventAt = new Date(dto.event_at);
    if (Number.isNaN(eventAt.getTime())) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
        message: 'event_at is not a valid date',
      });
    }

    const reminder = await this.reminderModel.create({
      userId,
      interactionId,
      eventAt,
      remindDaysBefore: dto.remind_days_before,
      remindAt: remindAtFromEvent(eventAt, dto.remind_days_before),
      note: dto.note?.trim() || null,
      status: ReminderStatus.Pendiente,
    });

    return this.toResponse(reminder);
  }

  async dispatchDue(now = new Date()): Promise<number> {
    if (this.dispatching) {
      return 0;
    }
    this.dispatching = true;
    try {
      const due = await this.reminderModel.findAll({
        where: {
          status: ReminderStatus.Pendiente,
          remindAt: { [Op.lte]: now },
          completedAt: null,
          [Op.or]: [
            { ouvInteractionId: { [Op.is]: null } },
            {
              ouvInteractionId: {
                [Op.in]: literal(
                  '(SELECT ouv_interaction_id FROM ouv_interactions WHERE deleted_at IS NULL)',
                ),
              },
            },
          ],
        },
        include: [
          { model: Interaction, required: false },
          { association: 'ouvInteraction', required: false },
        ],
        limit: 50,
      });

      let sent = 0;
      for (const reminder of due) {
        if (reminder.ouvInteractionId && !reminder.ouvInteraction) {
          continue;
        }
        const interaction = reminder.interaction;
        const entityId = interaction?.sqlId ?? interaction?.leadId ?? reminder.reminderId;
        const entityType = interaction?.sqlId ? EntityType.SQL : EntityType.LEAD;
        const note = reminder.note?.trim() || 'Tienes un recordatorio pendiente.';
        const created = await this.notificationModel.create({
          recipientUserId: reminder.userId,
          eventType: 'interaction.reminder',
          entityType,
          entityId,
          entityLabel: note.slice(0, 160),
          estadoNuevo: 'Recordatorio',
          titulo: 'Recordatorio',
          mensaje: note.slice(0, 400),
          actorUserId: reminder.userId,
          dedupKey: `interaction.reminder:${reminder.reminderId}`,
          metadata: {
            reminder_id: reminder.reminderId,
            interaction_id: reminder.interactionId,
            event_at: reminder.eventAt,
          },
        });
        await reminder.update({ status: ReminderStatus.Enviado });
        this.emitCreated(reminder.userId, created);
        sent += 1;
      }
      return sent;
    } finally {
      this.dispatching = false;
    }
  }

  /**
   * Bell list. Always the actor's reminders. Counts cover that whole set;
   * `group` and the page only narrow `items` and `total`.
   */
  async listMine(
    query: MyRemindersQueryDto,
    actorUserId: string,
    now = new Date(),
  ): Promise<PaginatedMyRemindersDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { listSql, countSql, countsSql, replacements } = buildMyRemindersSql({
      userId: actorUserId,
      groups: query.group ?? null,
      now,
      todayEnd: bogotaDayEnd(now),
      limit,
      offset: (page - 1) * limit,
    });
    const sequelize = this.reminderModel.sequelize;
    if (!sequelize) {
      throw new Error('Reminder model has no sequelize connection');
    }

    const [listed, totals, counts] = await Promise.all([
      sequelize.query<ListedReminder>(listSql, {
        replacements,
        type: QueryTypes.SELECT,
      }),
      sequelize.query<{ total: number | string }>(countSql, {
        replacements,
        type: QueryTypes.SELECT,
      }),
      sequelize.query<ReminderCountRow>(countsSql, {
        replacements,
        type: QueryTypes.SELECT,
      }),
    ]);

    const ids = listed.map((row) => row.reminder_id);
    const loaded = ids.length
      ? await this.reminderModel.findAll({
          where: { reminderId: { [Op.in]: ids } },
          include: [
            {
              association: 'interaction',
              required: false,
              include: [
                { association: 'lead', required: false },
                { association: 'sql', required: false },
              ],
            },
            {
              association: 'ouvInteraction',
              required: false,
              include: [{ association: 'ouv', required: false }],
            },
          ],
        })
      : [];
    const byId = new Map(loaded.map((row) => [row.reminderId, row]));
    const items: MyReminderItemDto[] = [];
    for (const row of listed) {
      const reminder = byId.get(row.reminder_id);
      if (!reminder) {
        continue;
      }
      const item = this.presentMine(reminder, row.reminder_group);
      if (item) {
        items.push(item);
      }
    }

    const countRow = counts[0];
    return {
      items,
      total: Number(totals[0]?.total ?? 0),
      page,
      limit,
      counts: {
        OVERDUE: Number(countRow?.overdue ?? 0),
        TODAY: Number(countRow?.today ?? 0),
        UPCOMING: Number(countRow?.upcoming ?? 0),
      },
    };
  }

  /**
   * Marks the follow-up done. Does not change `status` or any Outlook column.
   * Only the owner (`user_id`) may call this, for either source.
   */
  async complete(
    reminderId: string,
    actorUserId: string,
  ): Promise<ReminderActionResponseDto> {
    const reminder = await this.loadOwnedReminder(reminderId, actorUserId);
    this.assertCanComplete(reminder);
    await reminder.update({ completedAt: new Date() });
    return this.toActionResponse(reminder);
  }

  /**
   * Cancels a pending, not-yet-done reminder. A synced Outlook event is
   * marked PENDING so the sync job can delete it. This request does not
   * call Graph.
   */
  async cancel(
    reminderId: string,
    actorUserId: string,
  ): Promise<ReminderActionResponseDto> {
    const reminder = await this.loadOwnedReminder(reminderId, actorUserId);
    this.assertCanCancel(reminder);
    const patch: { status: ReminderStatus; outlookSyncStatus?: OutlookSyncStatus } =
      { status: ReminderStatus.Cancelado };
    if (reminder.outlookSyncStatus === OutlookSyncStatus.Synced) {
      patch.outlookSyncStatus = OutlookSyncStatus.Pending;
    }
    await reminder.update(patch);
    return this.toActionResponse(reminder);
  }

  private async loadOwnedReminder(
    reminderId: string,
    actorUserId: string,
  ): Promise<Reminder> {
    const reminder = await this.reminderModel.findByPk(reminderId, {
      paranoid: false,
    });
    if (!reminder) {
      throw new NotFoundException({
        code: DEMAND_GENERATION_ERROR_CODES.NOT_FOUND,
        message: 'Reminder not found',
      });
    }
    if (reminder.userId !== actorUserId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only the reminder owner can complete or cancel it',
      });
    }
    return reminder;
  }

  private assertCanComplete(reminder: Reminder): void {
    if (reminder.deletedAt) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Reminder was deleted',
      });
    }
    if (reminder.status === ReminderStatus.Cancelado) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Reminder is cancelled',
      });
    }
    if (reminder.completedAt) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Reminder is already completed',
      });
    }
  }

  private assertCanCancel(reminder: Reminder): void {
    if (reminder.deletedAt) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Reminder was deleted',
      });
    }
    if (reminder.completedAt) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'A completed reminder cannot be cancelled',
      });
    }
    if (reminder.status !== ReminderStatus.Pendiente) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Only a pending reminder can be cancelled',
      });
    }
  }

  private toActionResponse(reminder: Reminder): ReminderActionResponseDto {
    return {
      reminder_id: reminder.reminderId,
      interaction_id: reminder.interactionId,
      ouv_interaction_id: reminder.ouvInteractionId,
      user_id: reminder.userId,
      event_at: reminder.eventAt,
      remind_days_before: reminder.remindDaysBefore,
      remind_at: reminder.remindAt,
      note: reminder.note,
      status: reminder.status,
      completed_at: reminder.completedAt,
      outlook_sync_status: reminder.outlookSyncStatus,
      outlook_event_id: reminder.outlookEventId,
    };
  }

  private emitCreated(userId: string, row: Notification): void {
    if (!this.push) {
      return;
    }
    try {
      this.push.emitToUser(userId, {
        notification_id: row.notificationId,
        event_type: row.eventType,
        entity_type: row.entityType,
        entity_id: row.entityId,
        entity_label: row.entityLabel,
        titulo: row.titulo,
        mensaje: row.mensaje,
        estado_anterior: row.estadoAnterior ?? null,
        estado_nuevo: row.estadoNuevo,
        metadata: row.metadata ?? null,
        created_at: row.createdAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      this.logger.warn(
        `emitToUser failed notification_id=${row.notificationId}: ${message}`,
      );
    }
  }

  /**
   * LEAD when the interaction has no `sql_id`. SQL when `sql_id` is set.
   * OUV when the reminder points at `ouv_interactions`. A missing live
   * source is dropped: the SQL already excludes deleted interactions.
   */
  private presentMine(
    reminder: Reminder,
    group: ReminderGroup,
  ): MyReminderItemDto | null {
    const base = {
      reminder_id: reminder.reminderId,
      event_at: reminder.eventAt,
      remind_at: reminder.remindAt,
      note: reminder.note,
      status: reminder.status,
      group,
    };
    if (reminder.ouvInteractionId && reminder.ouvInteraction) {
      const ouv = reminder.ouvInteraction.ouv;
      return {
        ...base,
        source_type: 'OUV',
        source_id: ouv?.ouvId ?? reminder.ouvInteraction.ouvId,
        source_label: ouvSourceLabel(ouv?.consecutivo ?? '', ouv?.titulo ?? ''),
        interaction_title: reminder.ouvInteraction.titulo,
      };
    }
    if (reminder.interactionId && reminder.interaction) {
      const interaction = reminder.interaction;
      if (interaction.sqlId) {
        return {
          ...base,
          source_type: 'SQL',
          source_id: interaction.sqlId,
          source_label: sqlSourceLabel(interaction.sqlId),
          interaction_title: interaction.tipo,
        };
      }
      const name = interaction.lead?.name?.trim();
      return {
        ...base,
        source_type: 'LEAD',
        source_id: interaction.leadId,
        source_label: name || 'Lead',
        interaction_title: interaction.tipo,
      };
    }
    return null;
  }

  private toResponse(reminder: Reminder): ReminderResponseDto {
    return {
      reminder_id: reminder.reminderId,
      interaction_id: reminder.interactionId,
      event_at: reminder.eventAt,
      remind_days_before: reminder.remindDaysBefore,
      remind_at: reminder.remindAt,
      note: reminder.note,
      status: reminder.status,
    };
  }
}
