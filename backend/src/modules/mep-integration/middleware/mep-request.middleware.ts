import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import {
  MepErrorCode,
  ProblemDetails,
  problemTitle,
  problemType,
} from '../constants/error-catalog';
import { sendProblem } from '../filters/problem-response';

/**
 * Middleware transversal del contrato — §6, §10.3.
 *
 * Se aplica solo a las rutas `/v1/...` de esta integración; el resto del CRM no
 * cambia de comportamiento. Cubre, en este orden:
 *
 *  1. Contexto de correlación: `X-Correlation-ID` (eco o generado) y
 *     `request_id` propio del CRM, ambos presentes en toda respuesta.
 *  2. HSTS (§10.3).
 *  3. HTTPS obligatorio: HTTP plano → `426 Upgrade Required` (TS-SEC-08).
 *  4. `Content-Type: application/json` estricto en escrituras → `415`.
 *  5. `X-Correlation-ID` obligatorio en escrituras (§5.2) → `400`.
 *
 * El límite de 256 KB (§10.3) NO se aplica aquí: el parser de cuerpo corre
 * antes que cualquier middleware de módulo, así que vive en
 * `mep-body-limit.ts`, montado desde `main.ts`.
 *
 * Los rechazos se escriben aquí como `problem+json` en vez de lanzarse: una
 * excepción de middleware no llega al filtro acotado a los controladores del
 * contrato, sino al filtro global del CRM, que no usa este formato.
 */
@Injectable()
export class MepRequestMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const correlationId = this.readHeader(request, 'x-correlation-id');
    const resolvedCorrelationId = correlationId ?? `corr_${randomUUID()}`;

    request.mep = {
      correlationId: resolvedCorrelationId,
      requestId: randomUUID(),
      startedAt: Date.now(),
    };

    response.setHeader('X-Correlation-ID', resolvedCorrelationId);
    response.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );

    if (this.requiresHttps() && !this.isSecure(request)) {
      this.reject(
        request,
        response,
        426,
        'HTTPS_REQUIRED',
        'La API exige HTTPS (TLS 1.2+).',
        { Upgrade: 'TLS/1.2, HTTP/1.1', Connection: 'Upgrade' },
      );
      return;
    }

    const isWrite = request.method === 'POST' || request.method === 'PUT';

    if (isWrite) {
      const contentType = this.readHeader(request, 'content-type') ?? '';
      if (!contentType.split(';')[0].trim().endsWith('application/json')) {
        this.reject(
          request,
          response,
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'El contrato acepta exclusivamente `application/json`.',
        );
        return;
      }

      // §5.2 — `X-Correlation-ID` es obligatorio en toda escritura.
      if (!correlationId) {
        this.reject(
          request,
          response,
          400,
          'MISSING_CORRELATION_ID',
          'El header `X-Correlation-ID` es obligatorio en toda escritura.',
        );
        return;
      }
    }

    next();
  }

  private reject(
    request: Request,
    response: Response,
    status: number,
    code: MepErrorCode,
    detail: string,
    headers: Record<string, string> = {},
  ): void {
    const problem: ProblemDetails = {
      type: problemType(code),
      title: problemTitle(status),
      status,
      detail,
      instance: request.originalUrl?.split('?')[0],
      code,
      correlation_id: request.mep?.correlationId,
    };

    sendProblem(response, problem, headers);
  }

  private requiresHttps(): boolean {
    // En desarrollo local se desactiva explícitamente; en cualquier ambiente
    // desplegado el default es exigir HTTPS.
    return this.config.get<string>('MEP_REQUIRE_HTTPS', 'true') !== 'false';
  }

  private isSecure(request: Request): boolean {
    if (request.secure) {
      return true;
    }
    // Terminación TLS en el balanceador.
    const forwarded = this.readHeader(request, 'x-forwarded-proto');
    return forwarded?.split(',')[0].trim() === 'https';
  }

  private readHeader(request: Request, name: string): string | undefined {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  }
}
