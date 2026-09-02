import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ProblemDetails,
  problemTitle,
  problemType,
} from '../constants/error-catalog';
import { MepProblemException } from '../domain/mep-problem.exception';
import { AccessAuditService } from '../services/access-audit.service';
import { sendProblem } from './problem-response';

/** Estados cuyo rechazo se audita desde aquí (§12.2 `auth.failure`, `ratelimit.block`). */
const AUDITED_ACCESS_STATUSES = new Set([401, 403, 429]);

/**
 * Filtro de errores del contrato — §5.4 (T-005).
 *
 * Todo error de las 6 operaciones sale como `application/problem+json` con el
 * catálogo `ERR-*`. Se aplica solo a los controladores de esta integración.
 *
 * INV-02 / INV-31: el cuerpo de error nunca incluye `source_content`, el valor
 * de `X-API-Key` ni identificadores internos de MEP. Por eso no se propaga el
 * mensaje de una excepción desconocida: se responde `503` genérico y el
 * detalle queda solo en el log del servidor.
 */
@Catch()
export class MepProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(MepProblemFilter.name);

  constructor(private readonly accessAudit: AccessAuditService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const correlationId = request.mep?.correlationId;
    const instance = request.originalUrl?.split('?')[0];

    const problem = this.toProblem(exception, instance, correlationId);

    const headers: Record<string, string> = {};

    if (exception instanceof MepProblemException) {
      Object.assign(headers, exception.headers);
    }

    if (correlationId) {
      headers['X-Correlation-ID'] = correlationId;
    }

    if (AUDITED_ACCESS_STATUSES.has(problem.status)) {
      // Best-effort: la fila de auditoría no debe cambiar el código de
      // respuesta que el cliente recibe por un rechazo de acceso.
      void this.accessAudit.recordAccessFailure(
        request,
        problem.status,
        problem.code,
      );
    }

    sendProblem(response, problem, headers);
  }

  private toProblem(
    exception: unknown,
    instance: string | undefined,
    correlationId: string | undefined,
  ): ProblemDetails {
    if (exception instanceof MepProblemException) {
      return this.compact({
        type: problemType(exception.code),
        title: problemTitle(exception.getStatus()),
        status: exception.getStatus(),
        detail: exception.detail,
        instance,
        code: exception.code,
        correlation_id: correlationId,
        errors: exception.errors,
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = this.codeForStatus(status);
      return this.compact({
        type: problemType(code),
        title: problemTitle(status),
        status,
        detail: this.safeDetail(status),
        instance,
        code,
        correlation_id: correlationId,
      });
    }

    // Cualquier otra cosa es un fallo no clasificado del CRM: 503 transitorio
    // (§5.3 ERR-503). El mensaje original no viaja al cliente.
    this.logger.error(
      `Error no clasificado en la integración MEP: ${
        exception instanceof Error ? exception.message : String(exception)
      }`,
    );

    return this.compact({
      type: problemType('SERVICE_UNAVAILABLE'),
      title: problemTitle(503),
      status: 503,
      detail: 'Error transitorio del CRM. Reintente más tarde.',
      instance,
      code: 'SERVICE_UNAVAILABLE',
      correlation_id: correlationId,
    });
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case 400:
        return 'MALFORMED_REQUEST';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'INSUFFICIENT_SCOPE';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'VERSION_CONTENT_CONFLICT';
      case 412:
        return 'PRECONDITION_FAILED';
      case 413:
        return 'PAYLOAD_TOO_LARGE';
      case 415:
        return 'UNSUPPORTED_MEDIA_TYPE';
      case 422:
        return 'UNKNOWN_PROPERTY';
      case 429:
        return 'RATE_LIMIT_EXCEEDED';
      default:
        return 'SERVICE_UNAVAILABLE';
    }
  }

  private safeDetail(status: number): string {
    switch (status) {
      case 404:
        return 'El recurso solicitado no existe.';
      case 413:
        return 'El cuerpo de la solicitud supera los 256 KB permitidos.';
      case 415:
        return 'El contrato acepta exclusivamente `application/json`.';
      default:
        return 'La solicitud no pudo procesarse.';
    }
  }

  /** Omite claves vacías sin colapsar los nulos significativos del contrato. */
  private compact(problem: ProblemDetails): ProblemDetails {
    const out: ProblemDetails = {
      type: problem.type,
      title: problem.title,
      status: problem.status,
      code: problem.code,
    };

    if (problem.detail) {
      out.detail = problem.detail;
    }
    if (problem.instance) {
      out.instance = problem.instance;
    }
    if (problem.correlation_id) {
      out.correlation_id = problem.correlation_id;
    }
    if (problem.errors && problem.errors.length > 0) {
      out.errors = problem.errors;
    }

    return out;
  }
}
