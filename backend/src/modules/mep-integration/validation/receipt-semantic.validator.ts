import { Injectable } from '@nestjs/common';
import { MepErrorCode, ProblemErrorItem } from '../constants/error-catalog';
import { ProcessingStatus } from '../domain/enums';
import { MepProblemException } from '../domain/mep-problem.exception';
import { CreateProcessingReceiptDto } from '../dtos/create-processing-receipt.dto';
import { findForbiddenProperties } from './forbidden-properties';

export interface ReceiptValidationContext {
  /** Body crudo, antes del pipe — para el barrido de §7.4. */
  rawBody: unknown;
  /** Mayor `receipt_version` ya persistida para este `receipt_id`, o `null`. */
  latestReceiptVersion: number | null;
}

/**
 * Validador semántico de `POST .../processing-receipts` — §6.4.
 *
 * INV-13: el acuse es transporte; no muta la interacción comercial. Aquí solo
 * se validan sus propias reglas:
 *  - `reason_code` no nulo en QUARANTINED / REJECTED  → 422 MISSING_REASON_CODE
 *  - `receipt_version` monotónica por `receipt_id`    → 422 NON_MONOTONIC_VERSION
 *  - frontera LEAN (§7.4)                             → 422 UNKNOWN_PROPERTY
 */
@Injectable()
export class ReceiptSemanticValidator {
  validate(
    payload: CreateProcessingReceiptDto,
    context: ReceiptValidationContext,
  ): void {
    const errors: ProblemErrorItem[] = [];
    let primaryCode: MepErrorCode | null = null;
    let primaryDetail = '';

    for (const finding of findForbiddenProperties(context.rawBody)) {
      errors.push(finding);
      primaryCode ??= 'UNKNOWN_PROPERTY';
      primaryDetail ||= 'Propiedad fuera del contrato: frontera LEAN (§7.4).';
    }

    const requiresReason =
      payload.processing_status === ProcessingStatus.QUARANTINED ||
      payload.processing_status === ProcessingStatus.REJECTED;

    if (requiresReason && !payload.reason_code) {
      errors.push({ pointer: '/reason_code', code: 'MISSING_REASON_CODE' });
      primaryCode ??= 'MISSING_REASON_CODE';
      primaryDetail ||= `\`reason_code\` es obligatorio con processing_status = ${payload.processing_status}.`;
    }

    if (
      context.latestReceiptVersion !== null &&
      payload.receipt_version <= context.latestReceiptVersion
    ) {
      errors.push({
        pointer: '/receipt_version',
        code: 'NON_MONOTONIC_VERSION',
      });
      primaryCode ??= 'NON_MONOTONIC_VERSION';
      primaryDetail ||= `La versión ${payload.receipt_version} no supera la versión vigente ${context.latestReceiptVersion} de este receipt_id.`;
    }

    if (primaryCode === null) {
      return;
    }

    throw MepProblemException.unprocessable(primaryCode, primaryDetail, errors);
  }
}
