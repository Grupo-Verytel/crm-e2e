import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import {
  NotificationResponseDto,
  NotificationsQueryDto,
  PaginatedNotificationsResponseDto,
} from '../dtos/notification.dto';
import { Notification } from '../models/notification.model';

@Injectable()
export class NotificationsQueryService {
  constructor(
    @InjectModel(Notification)
    private readonly notificationModel: typeof Notification,
  ) {}

  async listForUser(
    userId: string,
    query: NotificationsQueryDto,
  ): Promise<PaginatedNotificationsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const where: WhereOptions<Notification> = {
      recipientUserId: userId,
    };

    if (query.read === false) {
      where.readAt = null;
    } else if (query.read === true) {
      where.readAt = { [Op.ne]: null };
    }

    const { rows, count } = await this.notificationModel.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      items: rows.map((row) => this.toResponse(row)),
      total: count,
      page,
      limit,
    };
  }

  async markRead(
    notificationId: string,
    userId: string,
  ): Promise<NotificationResponseDto> {
    const row = await this.notificationModel.findByPk(notificationId);
    if (!row || row.recipientUserId !== userId) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Notification ${notificationId} not found`,
      });
    }

    if (!row.readAt) {
      await row.update({ readAt: new Date() });
    }

    return this.toResponse(row);
  }

  private toResponse(row: Notification): NotificationResponseDto {
    return {
      notification_id: row.notificationId,
      event_type: row.eventType,
      entity_type: row.entityType,
      entity_id: row.entityId,
      entity_label: row.entityLabel,
      estado_anterior: row.estadoAnterior,
      estado_nuevo: row.estadoNuevo,
      titulo: row.titulo,
      mensaje: row.mensaje,
      actor_user_id: row.actorUserId,
      metadata: row.metadata,
      read_at: row.readAt,
      created_at: row.createdAt,
    };
  }
}
