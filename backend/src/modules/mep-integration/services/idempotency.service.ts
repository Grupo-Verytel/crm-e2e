import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction, UniqueConstraintError } from 'sequelize';
import { MepProblemException } from '../domain/mep-problem.exception';
import { IdempotencyRecord, IdempotencyStatus } from '../models';

/** Retención de las reservas de idempotencia: 7 días (§9.1 paso 5). */
export const IDEMPOTENCY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** `^[A-Za-z0-9._:-]{8,256}$` — §9.1 paso 1. */
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,256}$/;

export interface IdempotencyReplay {
  kind: 'replay';
  status: number;
  body: unknown;
  etag: string | null;
}

export interface IdempotencyReservation {
  kind: 'reserved';
  recordId: string;
  requestHash: string;
}

export type IdempotencyOutcome = IdempotencyReplay | IdempotencyReservation;

export interface IdempotencyKeyInput {
  apiKeyId: string;
  method: string;
  path: string;
  idempotencyKey: string;
  requestHash: string;
}

/**
 * Idempotencia de escritura — §9.1, INV-28 / INV-29.
 *
 * `begin()` reserva la clave en `IN_FLIGHT` **fuera** de la transacción de
 * negocio (para que las peticiones concurrentes la vean) y `complete()`
 * persiste el resultado **dentro** de la transacción de la mutación, de modo
 * que ambas cosas se confirman o se revierten juntas.
 *
 * Un replay devuelve la respuesta guardada sin ejecutar la lógica de negocio:
 * por eso un retry no avanza `response_version` (INV-29).
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @InjectModel(IdempotencyRecord)
    private readonly recordModel: typeof IdempotencyRecord,
  ) {}

  /** §9.1 paso 1 — formato y longitud de `Idempotency-Key`. */
  assertValidKey(key: string | undefined): string {
    if (!key) {
      throw MepProblemException.badRequest(
        'MISSING_IDEMPOTENCY_KEY',
        'El header `Idempotency-Key` es obligatorio en toda escritura.',
      );
    }

    if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
      throw MepProblemException.badRequest(
        'INVALID_IDEMPOTENCY_KEY',
        'El header `Idempotency-Key` debe tener entre 8 y 256 caracteres [A-Za-z0-9._:-].',
      );
    }

    return key;
  }

  async begin(
    input: IdempotencyKeyInput,
    now: Date = new Date(),
  ): Promise<IdempotencyOutcome> {
    try {
      const created = await this.recordModel.create({
        apiKeyId: input.apiKeyId,
        method: input.method,
        path: input.path,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        status: IdempotencyStatus.IN_FLIGHT,
        responseStatus: null,
        responseBody: null,
        responseEtag: null,
        expiresAt: new Date(now.getTime() + IDEMPOTENCY_RETENTION_MS),
      } as Partial<IdempotencyRecord>);

      return {
        kind: 'reserved',
        recordId: created.id,
        requestHash: input.requestHash,
      };
    } catch (error) {
      if (!(error instanceof UniqueConstraintError)) {
        throw error;
      }
      return this.resolveExisting(input);
    }
  }

  /**
   * Confirma la reserva con el resultado de la operación, dentro de la misma
   * transacción que la mutación (§9.1 paso 4).
   */
  async complete(
    recordId: string,
    result: { status: number; body: unknown; etag: string | null },
    transaction: Transaction,
  ): Promise<void> {
    await this.recordModel.update(
      {
        status: IdempotencyStatus.COMPLETED,
        responseStatus: result.status,
        responseBody: JSON.stringify(result.body),
        responseEtag: result.etag,
      },
      { where: { id: recordId }, transaction },
    );
  }

  /**
   * Libera una reserva cuya operación falló, para que el cliente pueda
   * reintentar con la misma clave. No toca reservas ya completadas.
   */
  async release(recordId: string): Promise<void> {
    try {
      await this.recordModel.destroy({
        where: { id: recordId, status: IdempotencyStatus.IN_FLIGHT },
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo liberar la reserva de idempotencia ${recordId}: ${(error as Error).message}`,
      );
    }
  }

  /** Purga de reservas vencidas — job diario de §9.1 paso 5. */
  async purgeExpired(now: Date = new Date()): Promise<number> {
    return this.recordModel.destroy({
      where: { expiresAt: { [Op.lt]: now } },
    });
  }

  private async resolveExisting(
    input: IdempotencyKeyInput,
  ): Promise<IdempotencyOutcome> {
    const existing = await this.recordModel.findOne({
      where: {
        apiKeyId: input.apiKeyId,
        method: input.method,
        path: input.path,
        idempotencyKey: input.idempotencyKey,
      },
    });

    if (!existing) {
      // La fila desapareció entre el INSERT fallido y esta lectura (purga o
      // release concurrente): es seguro pedir un reintento.
      throw MepProblemException.conflict(
        'REQUEST_IN_FLIGHT',
        'La clave de idempotencia está siendo procesada. Reintente.',
      );
    }

    if (existing.requestHash !== input.requestHash) {
      throw MepProblemException.conflict(
        'IDEMPOTENCY_KEY_REUSE',
        'La misma `Idempotency-Key` ya se usó con un contenido distinto.',
      );
    }

    if (existing.status === IdempotencyStatus.IN_FLIGHT) {
      throw MepProblemException.conflict(
        'REQUEST_IN_FLIGHT',
        'La clave de idempotencia está siendo procesada. Reintente.',
      );
    }

    return {
      kind: 'replay',
      status: existing.responseStatus ?? 200,
      body: existing.responseBody
        ? (JSON.parse(existing.responseBody) as unknown)
        : null,
      etag: existing.responseEtag,
    };
  }
}
