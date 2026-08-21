import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Transaction } from 'sequelize';
import { AuditAction } from '../audit/models/audit-action.enum';
import { AuditService } from '../audit/services/audit.service';
import { UsersService } from '../auth/services/users.service';
import { EntityType } from './enums/entity-type.enum';
import { WorkflowGuardRejectedException } from './exceptions/workflow-guard-rejected.exception';
import { WorkflowRuleNotFoundException } from './exceptions/workflow-rule-not-found.exception';
import {
  NOTIFICATION_PUSH_PORT,
  type NotificationPushPort,
} from './side-effects/notification-push.port';
import { NotificationsPersister } from './side-effects/notifications-persister';
import type {
  WorkflowGuardContext,
  WorkflowRule,
} from './types/workflow.types';
import { findWorkflowRule } from './workflow.rules';

export type WorkflowTransitionContext = {
  estadoAnterior: string | null;
  estadoNuevo: string;
  entityLabel: string;
  actorUserId: string;
  payload?: Record<string, unknown>;
  /** Optional entity snapshot for estado guards (prefers over estadoAnterior). */
  entity?: { estado: string } | null;
};

const ENTITY_TYPE_TO_TABLA: Record<EntityType, string> = {
  [EntityType.LEAD]: 'leads',
  [EntityType.MQL]: 'mqls',
  [EntityType.SQL]: 'sqls',
  [EntityType.CAMPANA]: 'campaigns',
  [EntityType.OUV]: 'ouvs',
  [EntityType.PRE]: 'preventas',
  [EntityType.PRI]: 'pricing',
  [EntityType.SER]: 'servicios',
  [EntityType.FACTURA]: 'facturas',
};

/**
 * Public API for domain services (spec §4.1).
 * Must be called inside an active Sequelize transaction.
 */
@Injectable()
export class WorkflowEngineService {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    private readonly notificationsPersister: NotificationsPersister,
    @Optional()
    @Inject(NOTIFICATION_PUSH_PORT)
    private readonly pushPort?: NotificationPushPort,
  ) {}

  async transition(
    entityType: EntityType,
    entityId: string,
    eventType: string,
    context: WorkflowTransitionContext,
    transaction: Transaction,
  ): Promise<void> {
    if (!transaction) {
      throw new Error(
        'WorkflowEngineService.transition requires an active Sequelize transaction',
      );
    }

    const rule = findWorkflowRule(eventType);
    if (!rule) {
      throw new WorkflowRuleNotFoundException(eventType);
    }

    const guardCtx: WorkflowGuardContext = {
      entityType,
      entityId,
      entityLabel: context.entityLabel,
      actorUserId: context.actorUserId,
      estadoAnterior: context.estadoAnterior,
      estadoNuevo: context.estadoNuevo,
      payload: context.payload ?? {},
      entity: context.entity ?? null,
      usersService: this.usersService,
    };

    for (const guard of rule.guards) {
      const result = await guard(guardCtx);
      if (!result.ok) {
        throw new WorkflowGuardRejectedException(result.guard, result.detalle);
      }
    }

    const recipientUserIds = await this.resolveRecipients(rule, guardCtx);
    const persisted = await this.notificationsPersister.persist(
      rule,
      guardCtx,
      recipientUserIds,
      transaction,
    );

    await this.auditService.recordSecurityEvent({
      accion: AuditAction.STATE_CHANGE,
      tabla: ENTITY_TYPE_TO_TABLA[entityType],
      registro_id: entityId,
      campo_modificado: 'estado',
      valor_anterior:
        context.estadoAnterior !== null
          ? JSON.stringify(context.estadoAnterior)
          : undefined,
      valor_nuevo: JSON.stringify(context.estadoNuevo),
      contexto: {
        event_type: eventType,
        entity_type: entityType,
        actor_user_id: context.actorUserId,
        ...(context.payload ?? {}),
      },
    });

    if (persisted.length > 0 && this.pushPort) {
      const push = this.pushPort;
      transaction.afterCommit(() => {
        for (const item of persisted) {
          push.emitToUser(item.recipientUserId, item.payload);
        }
      });
    }
  }

  private async resolveRecipients(
    rule: WorkflowRule,
    ctx: WorkflowGuardContext,
  ): Promise<string[]> {
    const ids = new Set<string>();

    for (const dest of rule.destinatarios) {
      if (dest.tipo === 'usuario') {
        const userId = dest.resolver(ctx);
        if (userId) {
          ids.add(userId);
        }
        continue;
      }

      const roleName = dest.resolver(ctx);
      const users = await this.usersService.findActiveByRoleName(roleName);
      for (const user of users) {
        ids.add(user.user_id);
      }
    }

    return [...ids];
  }
}
