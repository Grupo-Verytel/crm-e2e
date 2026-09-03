import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { Sequelize } from 'sequelize-typescript';
import { AuditOutcome } from '../models';
import { MepAuditService } from './mep-audit.service';

/**
 * Auditoría de hechos que ocurren fuera de una transacción de negocio — §12.2.
 *
 * Cubre las filas obligatorias sin mutación asociada: `auth.failure`
 * (401/403), `ratelimit.block` (429), `intake.poll` y `opportunity.read`.
 * Al no haber mutación que revertir, la escritura es best-effort: un fallo de
 * auditoría aquí se registra como `crm_audit_write_failures_total` pero no
 * convierte un 401 ni una lectura correcta en un 503 (INV-32 aplica a
 * mutaciones).
 */
@Injectable()
export class AccessAuditService {
  private readonly logger = new Logger(AccessAuditService.name);

  constructor(
    private readonly audit: MepAuditService,
    private readonly sequelize: Sequelize,
  ) {}

  async recordAccessFailure(
    request: Request,
    status: number,
    errorCode: string,
  ): Promise<void> {
    const context = request.mep;
    if (!context) {
      return;
    }

    const operation = status === 429 ? 'ratelimit.block' : 'auth.failure';

    try {
      await this.sequelize.transaction(async (transaction) => {
        await this.audit.record(
          {
            correlationId: context.correlationId,
            requestId: context.requestId,
            actorIdentity: context.identity?.identity ?? 'unknown',
            apiKeyPrefix: context.identity?.keyPrefix ?? null,
            sourceIp: request.ip ?? null,
            httpMethod: request.method,
            httpPath: request.originalUrl?.split('?')[0] ?? request.path,
            httpStatus: status,
            operation,
            resourceType: 'access',
            resourceRef: request.path,
            outcome: AuditOutcome.REJECTED,
            errorCode,
            latencyMs: Date.now() - context.startedAt,
          },
          transaction,
        );
      });
    } catch (error) {
      this.logger.error(
        `crm_audit_write_failure (${operation}): ${(error as Error).message}`,
      );
    }
  }

  /**
   * §12.2 `intake.poll` — se registra la forma de la página, **nunca** los
   * `items`: solo `count`, `cursor_in`, `next_cursor` y `high_watermark`
   * (TS-AUD-09). Así la bitácora no contiene `source_content` (INV-31).
   */
  async recordIntakePoll(
    request: Request,
    page: {
      count: number;
      cursorIn: string | null;
      nextCursor: string | null;
      highWatermark: string | null;
    },
  ): Promise<void> {
    await this.recordRead(request, {
      operation: 'intake.poll',
      resourceType: 'commercial_interaction',
      resourceRef: 'intake-page',
      afterState: {
        count: page.count,
        cursor_in: page.cursorIn,
        next_cursor: page.nextCursor,
        high_watermark: page.highWatermark,
      },
    });
  }

  /** §12.2 `opportunity.read`. */
  async recordOpportunityRead(
    request: Request,
    opportunityRef: string,
    status: number,
  ): Promise<void> {
    await this.recordRead(request, {
      operation: 'opportunity.read',
      resourceType: 'commercial_opportunity',
      resourceRef: opportunityRef,
      opportunityRef,
      status,
    });
  }

  private async recordRead(
    request: Request,
    entry: {
      operation: string;
      resourceType: string;
      resourceRef: string;
      opportunityRef?: string;
      interactionRef?: string;
      afterState?: unknown;
      status?: number;
    },
  ): Promise<void> {
    const context = request.mep;
    if (!context) {
      return;
    }

    try {
      await this.sequelize.transaction(async (transaction) => {
        await this.audit.record(
          {
            correlationId: context.correlationId,
            requestId: context.requestId,
            actorIdentity: context.identity?.identity ?? 'unknown',
            apiKeyPrefix: context.identity?.keyPrefix ?? null,
            sourceIp: request.ip ?? null,
            httpMethod: request.method,
            httpPath: request.originalUrl?.split('?')[0] ?? request.path,
            httpStatus: entry.status ?? 200,
            operation: entry.operation,
            resourceType: entry.resourceType,
            resourceRef: entry.resourceRef,
            interactionRef: entry.interactionRef ?? null,
            opportunityRef: entry.opportunityRef ?? null,
            outcome: AuditOutcome.SUCCESS,
            afterState: entry.afterState ?? null,
            latencyMs: Date.now() - context.startedAt,
          },
          transaction,
        );
      });
    } catch (error) {
      this.logger.error(
        `crm_audit_write_failure (${entry.operation}): ${(error as Error).message}`,
      );
    }
  }
}
