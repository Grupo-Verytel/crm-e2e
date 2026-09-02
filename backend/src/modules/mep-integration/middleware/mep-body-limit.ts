import { json } from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import {
  ProblemDetails,
  problemTitle,
  problemType,
} from '../constants/error-catalog';
import { sendProblem } from '../filters/problem-response';

/** Body máximo por request del contrato: 256 KB (§10.3). */
export const MAX_BODY_BYTES = 256 * 1024;

/** Prefijo de la superficie del contrato. */
const CONTRACT_PREFIX = '/v1/';

/**
 * Parser JSON del contrato — §10.3.
 *
 * Se monta en `main.ts` **antes** de que Nest registre el suyo, y solo sobre
 * `/v1`. Motivo: el límite del CRM (100 KB por defecto) es menor que los
 * 256 KB que el contrato debe aceptar, y el parser corre antes que cualquier
 * middleware de módulo, así que el límite no puede aplicarse desde
 * `MepRequestMiddleware`. Al marcar `req._body`, el parser global posterior de
 * Nest no vuelve a procesar el cuerpo: el resto del CRM conserva su límite.
 */
export function mepJsonBodyParser(): RequestHandler {
  return json({ limit: MAX_BODY_BYTES, type: 'application/json' });
}

/**
 * Traduce el `413` de `body-parser` al formato del contrato.
 *
 * Un error de parser ocurre antes del router, así que no lo ve el filtro
 * acotado a los controladores del contrato: se atiende aquí, y solo para las
 * rutas `/v1`. Cualquier otro error se delega intacto al CRM.
 */
export function mepBodyParserErrorHandler() {
  return (
    error: Error & { type?: string; status?: number },
    request: Request,
    response: Response,
    next: NextFunction,
  ): void => {
    const isContractRoute = request.originalUrl?.startsWith(CONTRACT_PREFIX);

    if (!isContractRoute || error?.type !== 'entity.too.large') {
      next(error);
      return;
    }

    const problem: ProblemDetails = {
      type: problemType('PAYLOAD_TOO_LARGE'),
      title: problemTitle(413),
      status: 413,
      detail: 'El cuerpo de la solicitud supera los 256 KB permitidos.',
      instance: request.originalUrl.split('?')[0],
      code: 'PAYLOAD_TOO_LARGE',
    };

    sendProblem(response, problem);
  };
}
