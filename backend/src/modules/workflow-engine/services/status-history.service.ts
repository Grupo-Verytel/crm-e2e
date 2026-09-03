import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import type { Transaction } from 'sequelize';
import { EntityType } from '../enums/entity-type.enum';
import {
  payloadString,
  triggerFromEventType,
  type StatusHistoryTriggerValue,
} from '../lib/status-history-trigger';
import { StatusHistory } from '../models/status-history.model';

export type RecordStatusHistoryInput = {
  entityType: EntityType | string;
  entityId: string;
  fromEstado: string | null;
  toEstado: string;
  trigger: StatusHistoryTriggerValue | string;
  changedBy?: string | null;
  rootLeadId?: string | null;
  motivo?: string | null;
  metadata?: Record<string, unknown> | null;
  transaction?: Transaction;
};

@Injectable()
export class StatusHistoryService {
  constructor(
    @InjectModel(StatusHistory)
    private readonly statusHistoryModel: typeof StatusHistory,
  ) {}

  /**
   * Append a funnel/status movement. No-ops when from === to (contactos,
   * checklist, criterios) so the timeline stays a real state machine.
   */
  async record(input: RecordStatusHistoryInput): Promise<StatusHistory | null> {
    if (input.fromEstado === input.toEstado) {
      return null;
    }

    return this.statusHistoryModel.create(
      {
        entityType: input.entityType,
        entityId: input.entityId,
        rootLeadId: input.rootLeadId ?? null,
        fromEstado: input.fromEstado,
        toEstado: input.toEstado,
        trigger: input.trigger,
        motivo: input.motivo ?? null,
        changedBy: input.changedBy ?? null,
        changedAt: new Date(),
        metadata: input.metadata ?? null,
      },
      { transaction: input.transaction },
    );
  }

  async recordWorkflowTransition(params: {
    entityType: EntityType;
    entityId: string;
    eventType: string;
    estadoAnterior: string | null;
    estadoNuevo: string;
    actorUserId: string;
    payload?: Record<string, unknown>;
    transaction: Transaction;
  }): Promise<StatusHistory | null> {
    const payload = params.payload ?? {};
    const rootLeadId =
      params.entityType === EntityType.LEAD
        ? params.entityId
        : payloadString(payload, 'leadId') ??
          payloadString(payload, 'lead_id') ??
          payloadString(payload, 'root_lead_id');

    return this.record({
      entityType: params.entityType,
      entityId: params.entityId,
      fromEstado: params.estadoAnterior,
      toEstado: params.estadoNuevo,
      trigger: triggerFromEventType(params.eventType),
      changedBy: params.actorUserId,
      rootLeadId,
      motivo:
        payloadString(payload, 'motivo') ??
        payloadString(payload, 'motivo_snapshot') ??
        payloadString(payload, 'comentario'),
      metadata: {
        event_type: params.eventType,
        ...primitivePayload(payload),
      },
      transaction: params.transaction,
    });
  }

  async findByEntity(
    entityType: EntityType | string,
    entityId: string,
  ): Promise<StatusHistory[]> {
    return this.statusHistoryModel.findAll({
      where: { entityType, entityId },
      order: [['changedAt', 'ASC']],
    });
  }
}

function primitivePayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      out[key] = value;
    }
  }
  return out;
}
