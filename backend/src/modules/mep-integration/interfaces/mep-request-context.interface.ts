import { MepScope } from '../constants/scopes';

/**
 * Identidad de servicio autenticada por `X-API-Key` (§10.1).
 *
 * Nunca transporta el valor de la clave: solo su `id`, su `keyPrefix` de 12
 * caracteres (lo único que puede aparecer en logs y auditoría, INV-31) y sus
 * scopes.
 */
export interface MepApiIdentity {
  apiKeyId: string;
  identity: string;
  environment: string;
  keyPrefix: string;
  scopes: MepScope[];
  rateTier: string;
}

/**
 * Contexto por petición del contrato CRM ↔ MEP-LEAN.
 * Lo puebla `CorrelationMiddleware` y lo completa `ApiKeyGuard`.
 */
export interface MepRequestContext {
  /** `X-Correlation-ID` recibido, o generado si no vino (§6). */
  correlationId: string;
  /** Identificador propio del CRM para esta petición. */
  requestId: string;
  /** Inicio de la petición, para `latency_ms` de auditoría. */
  startedAt: number;
  identity?: MepApiIdentity;
  /** Cuerpo crudo, previo a la validación, para el barrido de §7.4. */
  rawBody?: unknown;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      mep?: MepRequestContext;
    }
  }
}
