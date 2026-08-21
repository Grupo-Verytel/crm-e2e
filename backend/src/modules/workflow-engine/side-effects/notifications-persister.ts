import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UniqueConstraintError, type Transaction } from 'sequelize';
import { Notification } from '../models/notification.model';
import type { EntityType } from '../enums/entity-type.enum';
import type { WorkflowGuardContext, WorkflowRule } from '../types/workflow.types';
import type { NotificationPushPayload } from './notification-push.port';

export type PersistedNotification = {
  recipientUserId: string;
  payload: NotificationPushPayload;
};

/**
 * Sync writer for `notifications` inside the active business transaction.
 * Dedup UNIQUE violations are treated as success (EARS-05).
 */
@Injectable()
export class NotificationsPersister {
  constructor(
    @InjectModel(Notification)
    private readonly notificationModel: typeof Notification,
  ) {}

  async persist(
    rule: WorkflowRule,
    ctx: WorkflowGuardContext,
    recipientUserIds: string[],
    transaction: Transaction,
  ): Promise<PersistedNotification[]> {
    const created: PersistedNotification[] = [];
    const titulo = rule.titulo(ctx).slice(0, 160);
    const mensaje = rule.mensaje(ctx).slice(0, 400);
    const metadata =
      Object.keys(ctx.payload).length > 0
        ? (ctx.payload as Record<string, unknown>)
        : null;

    for (const recipientUserId of recipientUserIds) {
      if (!recipientUserId) {
        continue;
      }

      const dedupKey = `${rule.eventType}:${ctx.entityId}:${recipientUserId}`;
      const row = await this.insertOne(
        {
          recipientUserId,
          eventType: rule.eventType,
          entityType: ctx.entityType,
          entityId: ctx.entityId,
          entityLabel: ctx.entityLabel.slice(0, 160),
          estadoAnterior: ctx.estadoAnterior,
          estadoNuevo: ctx.estadoNuevo,
          titulo,
          mensaje,
          actorUserId: ctx.actorUserId || null,
          metadata,
          dedupKey,
        },
        transaction,
      );

      if (!row) {
        continue;
      }

      created.push({
        recipientUserId,
        payload: {
          notification_id: row.notificationId,
          event_type: row.eventType,
          entity_type: row.entityType,
          entity_id: row.entityId,
          entity_label: row.entityLabel,
          titulo: row.titulo,
          mensaje: row.mensaje,
          estado_anterior: row.estadoAnterior,
          estado_nuevo: row.estadoNuevo,
          metadata: row.metadata,
          created_at: row.createdAt,
        },
      });
    }

    return created;
  }

  private async insertOne(
    attrs: {
      recipientUserId: string;
      eventType: string;
      entityType: EntityType;
      entityId: string;
      entityLabel: string;
      estadoAnterior: string | null;
      estadoNuevo: string;
      titulo: string;
      mensaje: string;
      actorUserId: string | null;
      metadata: Record<string, unknown> | null;
      dedupKey: string;
    },
    transaction: Transaction,
  ): Promise<Notification | null> {
    try {
      return await this.notificationModel.create(attrs, { transaction });
    } catch (error) {
      if (this.isDedupViolation(error)) {
        return null;
      }
      throw error;
    }
  }

  private isDedupViolation(error: unknown): boolean {
    if (!(error instanceof UniqueConstraintError)) {
      return false;
    }

    const fields = error.fields ?? {};
    if ('dedup_key' in fields || 'dedupKey' in fields) {
      return true;
    }

    const parent = error.parent as { code?: string; sqlMessage?: string } | null;
    if (parent?.code === 'ER_DUP_ENTRY' && parent.sqlMessage?.includes('dedup')) {
      return true;
    }

    return error.errors?.some((e) => e.path === 'dedup_key' || e.path === 'dedupKey') ?? false;
  }
}
