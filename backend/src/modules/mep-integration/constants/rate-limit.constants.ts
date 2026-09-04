/**
 * Cuotas de rate limiting — §11.1.
 *
 * Token bucket por `api_key_id` × clase de operación. Los valores son
 * configurables por ambiente y por `rate_tier` de la key; sandbox usa 1/4 de
 * los límites de producción. Valores definitivos pendientes de OPEN-08.
 */

export enum RateLimitClass {
  READ_LIST = 'read-list',
  READ_ITEM = 'read-item',
  WRITE = 'write',
  GLOBAL = 'global',
}

export interface RateLimitQuota {
  /** Límite sostenido por ventana. */
  limit: number;
  /** Capacidad de ráfaga adicional del bucket. */
  burst: number;
  /** Ventana en segundos. */
  windowSeconds: number;
}

export const DEFAULT_QUOTAS: Record<RateLimitClass, RateLimitQuota> = {
  [RateLimitClass.READ_LIST]: { limit: 60, burst: 20, windowSeconds: 60 },
  [RateLimitClass.READ_ITEM]: { limit: 300, burst: 100, windowSeconds: 60 },
  [RateLimitClass.WRITE]: { limit: 120, burst: 40, windowSeconds: 60 },
  [RateLimitClass.GLOBAL]: { limit: 600, burst: 200, windowSeconds: 60 },
};

/** Concurrencia máxima in-flight por key (§11.1). */
export const MAX_IN_FLIGHT_PER_KEY = 20;

/** Sandbox opera con 1/4 de los límites de producción (§11.1). */
export const SANDBOX_QUOTA_DIVISOR = 4;

export function quotaFor(
  rateLimitClass: RateLimitClass,
  environment: string,
  multiplier = 1,
): RateLimitQuota {
  const base = DEFAULT_QUOTAS[rateLimitClass];
  const divisor = environment === 'sandbox' ? SANDBOX_QUOTA_DIVISOR : 1;
  const scale = (value: number) =>
    Math.max(1, Math.floor((value * multiplier) / divisor));

  return {
    limit: scale(base.limit),
    burst: scale(base.burst),
    windowSeconds: base.windowSeconds,
  };
}
