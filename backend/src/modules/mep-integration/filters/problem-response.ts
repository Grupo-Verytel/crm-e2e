import { Response } from 'express';
import {
  PROBLEM_CONTENT_TYPE,
  ProblemDetails,
} from '../constants/error-catalog';

/**
 * Emisión de un `application/problem+json` (§5.4).
 *
 * Vive aparte del filtro porque el middleware del contrato también necesita
 * responder problemas (426, 415, 413, 400) y las excepciones lanzadas en un
 * middleware **no** llegan a un filtro acotado a controladores: las atiende el
 * filtro global del CRM, que no habla este formato. El middleware, por tanto,
 * escribe la respuesta él mismo con esta función.
 */
export function sendProblem(
  response: Response,
  problem: ProblemDetails,
  headers: Record<string, string> = {},
): void {
  for (const [header, value] of Object.entries(headers)) {
    response.setHeader(header, value);
  }

  response
    .status(problem.status)
    .type(PROBLEM_CONTENT_TYPE)
    .send(JSON.stringify(problem));
}
