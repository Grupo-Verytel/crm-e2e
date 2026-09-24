import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { DEMAND_GENERATION_ERROR_CODES } from '../constants/demand-generation.constants';
import { CreateReminderDto } from '../dtos/create-reminder.dto';
import { ReminderResponseDto } from '../dtos/reminder-response.dto';
import { ReminderStatus } from '../models/enums/reminder-status.enum';
import { Interaction } from '../models/interaction.model';
import { Reminder } from '../models/reminder.model';
import { EntityType } from '../../workflow-engine/enums/entity-type.enum';
import { Notification } from '../../workflow-engine/models/notification.model';

const DAY_MS = 24 * 60 * 60 * 1000;
const DISPATCH_INTERVAL_MS = 60_000;

/**
 * America/Bogota has no DST (UTC−5), so N calendar days before the same
 * clock time is exactly N × 24 hours.
 */
export function remindAtFromEvent(eventAt: Date, daysBefore: number): Date {
  return new Date(eventAt.getTime() - daysBefore * DAY_MS);
}

@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;
  private dispatching = false;

  constructor(
    @InjectModel(Reminder) private readonly reminderModel: typeof Reminder,
    @InjectModel(Interaction)
    private readonly interactionModel: typeof Interaction,
    @InjectModel(Notification)
    private readonly notificationModel: typeof Notification,
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
        },
        include: [{ model: Interaction, required: false }],
        limit: 50,
      });

      let sent = 0;
      for (const reminder of due) {
        const interaction = reminder.interaction;
        const entityId = interaction?.sqlId ?? interaction?.leadId ?? reminder.reminderId;
        const entityType = interaction?.sqlId ? EntityType.SQL : EntityType.LEAD;
        const note = reminder.note?.trim() || 'Tienes un recordatorio pendiente.';
        await this.notificationModel.create({
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
        sent += 1;
      }
      return sent;
    } finally {
      this.dispatching = false;
    }
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
