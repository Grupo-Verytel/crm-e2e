import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Transaction } from 'sequelize';
import { canonicalHash } from '../domain/canonical-json';
import { etagMatches, resourceEtag } from '../domain/etag';
import { MepProblemException } from '../domain/mep-problem.exception';
import { CreateProcessingReceiptDto } from '../dtos/create-processing-receipt.dto';
import {
  AuditOutcome,
  CommercialInteraction,
  ProcessingReceipt,
} from '../models';
import { presentProcessingReceipt } from '../presenters/contract.presenter';
import { ReceiptSemanticValidator } from '../validation/receipt-semantic.validator';
import { IdempotencyService } from './idempotency.service';
import { MepAuditService } from './mep-audit.service';
import { MepWriteContext, MepWriteResult } from './write-result.interface';

/**
 * Acuse técnico — §6.4 (T-201, T-202).
 *
 * INV-12: es un hecho de transporte. **No** sustituye al hito comercial
 * `INTERACTION_RECEIVED` y el CRM no los trata como el mismo estado.
 * INV-13: no muta campos comerciales de la interacción (`source_content`,
 * `etag`, horizonte, subject). Sí actualiza `polling_status` como caché del
 * último `processing_status` del acuse, en la misma transacción.
 */
@Injectable()
export class ProcessingReceiptService {
  constructor(
    @InjectModel(CommercialInteraction)
    private readonly interactionModel: typeof CommercialInteraction,
    @InjectModel(ProcessingReceipt)
    private readonly receiptModel: typeof ProcessingReceipt,
    private readonly idempotency: IdempotencyService,
    private readonly validator: ReceiptSemanticValidator,
    private readonly audit: MepAuditService,
    private readonly sequelize: Sequelize,
  ) {}

  async create(
    interactionRef: string,
    payload: CreateProcessingReceiptDto,
    context: MepWriteContext,
  ): Promise<MepWriteResult> {
    const interaction = await this.interactionModel.findOne({
      where: { crmInteractionRef: interactionRef },
    });

    if (!interaction) {
      throw MepProblemException.notFound(
        'La interacción indicada no existe o no es visible para esta identidad.',
      );
    }

    // §9.2 — `If-Match` se contrasta contra el recurso que MEP leyó antes de
    // acusar: la interacción comercial.
    if (context.ifMatch && !etagMatches(context.ifMatch, interaction.etag)) {
      await this.auditRejection(
        context,
        interactionRef,
        412,
        'PRECONDITION_FAILED',
      );
      throw MepProblemException.preconditionFailed(
        'El `If-Match` no coincide con la versión actual de la interacción.',
      );
    }

    const requestHash = canonicalHash(context.rawBody);

    const reservation = await this.idempotency.begin({
      apiKeyId: context.identity.apiKeyId,
      method: context.httpMethod,
      path: context.httpPath,
      idempotencyKey: context.idempotencyKey,
      requestHash,
    });

    if (reservation.kind === 'replay') {
      await this.auditReplay(context, interactionRef, payload, requestHash);
      return {
        status: reservation.status,
        body: reservation.body,
        etag: reservation.etag,
        replay: true,
      };
    }

    try {
      const latest = await this.receiptModel.findOne({
        where: { receiptId: payload.receipt_id },
        order: [['receipt_version', 'DESC']],
      });

      // Mismo `(receipt_id, receipt_version)`: replay si el contenido es
      // idéntico, 409 si difiere (§6.4).
      const sameVersion = await this.receiptModel.findOne({
        where: {
          receiptId: payload.receipt_id,
          receiptVersion: payload.receipt_version,
        },
      });

      if (sameVersion) {
        const persisted = presentProcessingReceipt(sameVersion);
        if (sameVersion.payloadHash === requestHash) {
          await this.idempotencyCompleteStandalone(reservation.recordId, {
            status: 200,
            body: persisted,
            etag: sameVersion.etag,
          });
          return {
            status: 200,
            body: persisted,
            etag: sameVersion.etag,
            replay: true,
          };
        }

        await this.idempotency.release(reservation.recordId);
        await this.auditRejection(
          context,
          interactionRef,
          409,
          'RECEIPT_CONTENT_CONFLICT',
        );
        throw MepProblemException.conflict(
          'RECEIPT_CONTENT_CONFLICT',
          'Ya existe ese `(receipt_id, receipt_version)` con contenido distinto.',
        );
      }

      this.validator.validate(payload, {
        rawBody: context.rawBody,
        latestReceiptVersion: latest ? Number(latest.receiptVersion) : null,
      });

      const etag = resourceEtag(
        `receipt-${payload.receipt_id}`,
        payload.receipt_version,
      );

      const body = await this.sequelize.transaction(
        { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
        async (transaction) => {
          const created = await this.receiptModel.create(
            {
              interactionId: interaction.id,
              receiptId: payload.receipt_id,
              receiptVersion: payload.receipt_version,
              processingStatus: payload.processing_status,
              correlationId: payload.correlation_id,
              observedAt: new Date(payload.observed_at),
              adapterVersion: payload.adapter_version,
              reasonCode: payload.reason_code,
              semanticFingerprint: payload.semantic_fingerprint,
              payloadHash: requestHash,
              etag,
            } as Partial<ProcessingReceipt>,
            { transaction },
          );

          const persisted = presentProcessingReceipt(created);

          await this.interactionModel.update(
            { pollingStatus: payload.processing_status },
            { where: { id: interaction.id }, transaction },
          );

          // INV-32: la auditoría va en la misma transacción que la mutación.
          await this.audit.record(
            {
              correlationId: context.correlationId,
              requestId: context.requestId,
              actorIdentity: context.identity.identity,
              apiKeyPrefix: context.identity.keyPrefix,
              sourceIp: context.sourceIp,
              httpMethod: context.httpMethod,
              httpPath: context.httpPath,
              httpStatus: 201,
              operation: 'receipt.create',
              resourceType: 'processing_receipt',
              resourceRef: `${payload.receipt_id}#${payload.receipt_version}`,
              interactionRef,
              opportunityRef: interaction.crmOpportunityRef,
              idempotencyKey: context.idempotencyKey,
              idempotentReplay: false,
              ifMatch: context.ifMatch,
              outcome: AuditOutcome.SUCCESS,
              requestHash,
              beforeState: null,
              afterState: persisted,
              latencyMs: Date.now() - context.startedAt,
              adapterVersion: payload.adapter_version,
            },
            transaction,
          );

          await this.idempotency.complete(
            reservation.recordId,
            { status: 201, body: persisted, etag },
            transaction,
          );

          return persisted;
        },
      );

      return {
        status: 201,
        body,
        etag,
        location: `/v1/commercial-interactions/${encodeURIComponent(interactionRef)}/processing-receipts/${encodeURIComponent(payload.receipt_id)}`,
        replay: false,
      };
    } catch (error) {
      await this.idempotency.release(reservation.recordId);

      if (error instanceof MepProblemException && error.getStatus() === 422) {
        await this.auditRejection(context, interactionRef, 422, error.code);
      }

      throw error;
    }
  }

  /**
   * Cierra la reserva de idempotencia cuando la operación no abre transacción
   * propia (caso replay por `(receipt_id, receipt_version)` ya persistido).
   */
  private async idempotencyCompleteStandalone(
    recordId: string,
    result: { status: number; body: unknown; etag: string | null },
  ): Promise<void> {
    await this.sequelize.transaction(async (transaction) => {
      await this.idempotency.complete(recordId, result, transaction);
    });
  }

  private async auditReplay(
    context: MepWriteContext,
    interactionRef: string,
    payload: CreateProcessingReceiptDto,
    requestHash: string,
  ): Promise<void> {
    await this.sequelize.transaction(async (transaction) => {
      await this.audit.record(
        {
          correlationId: context.correlationId,
          requestId: context.requestId,
          actorIdentity: context.identity.identity,
          apiKeyPrefix: context.identity.keyPrefix,
          sourceIp: context.sourceIp,
          httpMethod: context.httpMethod,
          httpPath: context.httpPath,
          httpStatus: 200,
          operation: 'receipt.replay',
          resourceType: 'processing_receipt',
          resourceRef: `${payload.receipt_id}#${payload.receipt_version}`,
          interactionRef,
          idempotencyKey: context.idempotencyKey,
          idempotentReplay: true,
          ifMatch: context.ifMatch,
          outcome: AuditOutcome.SUCCESS,
          requestHash,
          latencyMs: Date.now() - context.startedAt,
          adapterVersion: payload.adapter_version,
        },
        transaction,
      );
    });
  }

  private async auditRejection(
    context: MepWriteContext,
    interactionRef: string,
    status: number,
    errorCode: string,
  ): Promise<void> {
    await this.sequelize.transaction(async (transaction) => {
      await this.audit.record(
        {
          correlationId: context.correlationId,
          requestId: context.requestId,
          actorIdentity: context.identity.identity,
          apiKeyPrefix: context.identity.keyPrefix,
          sourceIp: context.sourceIp,
          httpMethod: context.httpMethod,
          httpPath: context.httpPath,
          httpStatus: status,
          operation:
            status === 409
              ? 'receipt.conflict'
              : status === 412
                ? 'receipt.precondition_failed'
                : 'receipt.reject',
          resourceType: 'processing_receipt',
          resourceRef: interactionRef,
          interactionRef,
          idempotencyKey: context.idempotencyKey,
          ifMatch: context.ifMatch,
          outcome: AuditOutcome.REJECTED,
          errorCode,
          latencyMs: Date.now() - context.startedAt,
        },
        transaction,
      );
    });
  }
}
