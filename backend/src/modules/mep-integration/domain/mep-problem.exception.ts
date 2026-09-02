import { HttpException } from '@nestjs/common';
import {
  MepErrorCode,
  ProblemErrorItem,
  problemTitle,
  problemType,
} from '../constants/error-catalog';

/**
 * Excepción de dominio del contrato CRM ↔ MEP-LEAN.
 *
 * El filtro global (`MepProblemFilter`) la serializa como
 * `application/problem+json` (§5.4). Nunca transporta `source_content`,
 * la API key ni identificadores internos de MEP (INV-02).
 */
export class MepProblemException extends HttpException {
  readonly code: MepErrorCode;
  readonly detail?: string;
  readonly errors?: ProblemErrorItem[];
  /** Headers extra a emitir con la respuesta (p. ej. `Retry-After`). */
  readonly headers: Record<string, string>;

  constructor(
    status: number,
    code: MepErrorCode,
    detail?: string,
    errors?: ProblemErrorItem[],
    headers: Record<string, string> = {},
  ) {
    super(
      {
        type: problemType(code),
        title: problemTitle(status),
        status,
        detail,
        code,
        errors,
      },
      status,
    );
    this.code = code;
    this.detail = detail;
    this.errors = errors;
    this.headers = headers;
  }

  static badRequest(
    code: MepErrorCode,
    detail?: string,
    errors?: ProblemErrorItem[],
  ): MepProblemException {
    return new MepProblemException(400, code, detail, errors);
  }

  static unauthorized(detail?: string): MepProblemException {
    // §10.2: cuerpo genérico — no distingue ausente/inválida/revocada/expirada.
    return new MepProblemException(401, 'UNAUTHORIZED', detail);
  }

  static forbidden(detail?: string): MepProblemException {
    return new MepProblemException(403, 'INSUFFICIENT_SCOPE', detail);
  }

  static notFound(detail?: string): MepProblemException {
    return new MepProblemException(404, 'NOT_FOUND', detail);
  }

  static conflict(
    code: MepErrorCode,
    detail?: string,
    errors?: ProblemErrorItem[],
  ): MepProblemException {
    return new MepProblemException(409, code, detail, errors);
  }

  static preconditionFailed(detail?: string): MepProblemException {
    return new MepProblemException(412, 'PRECONDITION_FAILED', detail);
  }

  static unprocessable(
    code: MepErrorCode,
    detail?: string,
    errors?: ProblemErrorItem[],
  ): MepProblemException {
    return new MepProblemException(422, code, detail, errors);
  }

  static rateLimited(retryAfterSeconds: number, detail?: string) {
    return new MepProblemException(
      429,
      'RATE_LIMIT_EXCEEDED',
      detail,
      undefined,
      {
        'Retry-After': String(retryAfterSeconds),
      },
    );
  }

  static unavailable(
    code: MepErrorCode = 'SERVICE_UNAVAILABLE',
    detail?: string,
    retryAfterSeconds = 5,
  ): MepProblemException {
    return new MepProblemException(503, code, detail, undefined, {
      'Retry-After': String(retryAfterSeconds),
    });
  }
}
