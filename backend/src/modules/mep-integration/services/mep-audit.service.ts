import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';
import { canonicalize, sha256Hex } from '../domain/canonical-json';
import { MepProblemException } from '../domain/mep-problem.exception';
import { AuditActorType, AuditOutcome, MepAuditLog } from '../models';

export interface AuditEntryInput {
  occurredAt?: Date;
  correlationId: string;
  requestId: string;
  actorType?: AuditActorType;
  actorIdentity: string;
  apiKeyPrefix?: string | null;
  sourceIp?: string | null;
  httpMethod: string;
  httpPath: string;
  httpStatus: number;
  operation: string;
  resourceType: string;
  resourceRef: string;
  interactionRef?: string | null;
  opportunityRef?: string | null;
  idempotencyKey?: string | null;
  idempotentReplay?: boolean;
  ifMatch?: string | null;
  outcome: AuditOutcome;
  errorCode?: string | null;
  requestHash?: string | null;
  beforeState?: unknown;
  afterState?: unknown;
  latencyMs: number;
  adapterVersion?: string | null;
}

/** Claves cuyo valor jamás se persiste en claro en la auditoría (INV-31). */
const REDACTED_KEYS = new Set(['source_content', 'sourcecontent']);

/** Claves que nunca deben aparecer, ni redactadas, en `before/after_state`. */
const DROPPED_KEYS = new Set([
  'x-api-key',
  'apikey',
  'api_key',
  'authorization',
]);

/**
 * Bitácora de la integración — §12.
 *
 * INV-32: `record()` recibe la transacción de la mutación y escribe dentro de
 * ella. Si la escritura de auditoría falla, el llamador revierte y responde
 * `503` (`AUDIT_WRITE_FAILED`).
 * INV-34: cada entrada encadena `prev_hash` → `entry_hash`.
 */
@Injectable()
export class MepAuditService {
  private readonly logger = new Logger(MepAuditService.name);

  constructor(
    @InjectModel(MepAuditLog) private readonly auditModel: typeof MepAuditLog,
  ) {}

  /**
   * Escribe una entrada dentro de la transacción dada.
   * Lanza `MepProblemException` 503 si la auditoría no puede persistirse.
   */
  async record(
    input: AuditEntryInput,
    transaction?: Transaction,
  ): Promise<MepAuditLog> {
    const occurredAt = input.occurredAt ?? new Date();

    try {
      const previous = await this.auditModel.findOne({
        order: [['id', 'DESC']],
        transaction,
        ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
      });

      const prevHash = previous?.entryHash ?? null;

      const payload = {
        occurredAt: occurredAt.toISOString(),
        correlationId: input.correlationId,
        requestId: input.requestId,
        actorType: input.actorType ?? AuditActorType.SERVICE,
        actorIdentity: input.actorIdentity,
        apiKeyPrefix: input.apiKeyPrefix ?? null,
        sourceIp: input.sourceIp ?? null,
        httpMethod: input.httpMethod,
        httpPath: input.httpPath,
        httpStatus: input.httpStatus,
        operation: input.operation,
        resourceType: input.resourceType,
        resourceRef: input.resourceRef,
        interactionRef: input.interactionRef ?? null,
        opportunityRef: input.opportunityRef ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        idempotentReplay: input.idempotentReplay ?? false,
        ifMatch: input.ifMatch ?? null,
        outcome: input.outcome,
        errorCode: input.errorCode ?? null,
        requestHash: input.requestHash ?? null,
        beforeState: redact(input.beforeState),
        afterState: redact(input.afterState),
        latencyMs: input.latencyMs,
        adapterVersion: input.adapterVersion ?? null,
      };

      const entryHash = sha256Hex(`${prevHash ?? ''}${canonicalize(payload)}`);

      return await this.auditModel.create(
        {
          ...payload,
          occurredAt,
          prevHash,
          entryHash,
        },
        { transaction },
      );
    } catch (error) {
      if (error instanceof MepProblemException) {
        throw error;
      }
      // §13.3 `crm_audit_write_failures_total`; INV-32 revierte la mutación.
      this.logger.error(`crm_audit_write_failure: ${(error as Error).message}`);
      throw MepProblemException.unavailable(
        'AUDIT_WRITE_FAILED',
        'No fue posible registrar la auditoría de la operación.',
      );
    }
  }

  /**
   * Verifica la integridad de la cadena (INV-34, TS-AUD-07).
   * Devuelve el `id` de la primera entrada rota, o `null` si está íntegra.
   */
  async verifyChain(limit = 1000): Promise<string | null> {
    const entries = await this.auditModel.findAll({
      order: [['id', 'ASC']],
      limit,
    });

    let expectedPrev: string | null = null;

    for (const entry of entries) {
      if ((entry.prevHash ?? null) !== expectedPrev) {
        return entry.id;
      }

      const payload = {
        occurredAt: entry.occurredAt.toISOString(),
        correlationId: entry.correlationId,
        requestId: entry.requestId,
        actorType: entry.actorType,
        actorIdentity: entry.actorIdentity,
        apiKeyPrefix: entry.apiKeyPrefix ?? null,
        sourceIp: entry.sourceIp ?? null,
        httpMethod: entry.httpMethod,
        httpPath: entry.httpPath,
        httpStatus: entry.httpStatus,
        operation: entry.operation,
        resourceType: entry.resourceType,
        resourceRef: entry.resourceRef,
        interactionRef: entry.interactionRef ?? null,
        opportunityRef: entry.opportunityRef ?? null,
        idempotencyKey: entry.idempotencyKey ?? null,
        idempotentReplay: entry.idempotentReplay,
        ifMatch: entry.ifMatch ?? null,
        outcome: entry.outcome,
        errorCode: entry.errorCode ?? null,
        requestHash: entry.requestHash ?? null,
        beforeState: entry.beforeState ?? null,
        afterState: entry.afterState ?? null,
        latencyMs: entry.latencyMs,
        adapterVersion: entry.adapterVersion ?? null,
      };

      const recomputed = sha256Hex(
        `${entry.prevHash ?? ''}${canonicalize(payload)}`,
      );

      if (recomputed !== entry.entryHash) {
        return entry.id;
      }

      expectedPrev = entry.entryHash;
    }

    return null;
  }
}

/**
 * Redacción de estados (INV-31): `source_content` se reemplaza por
 * `{sha256, length}` y las claves de credencial se eliminan por completo.
 */
export function redact(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  const out: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.toLowerCase();

    if (DROPPED_KEYS.has(normalized)) {
      continue;
    }

    if (REDACTED_KEYS.has(normalized) && typeof entry === 'string') {
      out[key] = { sha256: sha256Hex(entry), length: entry.length };
      continue;
    }

    out[key] = redact(entry);
  }

  return out;
}
