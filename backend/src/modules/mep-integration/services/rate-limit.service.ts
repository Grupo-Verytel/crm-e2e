import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MAX_IN_FLIGHT_PER_KEY,
  RateLimitClass,
  RateLimitQuota,
  quotaFor,
} from '../constants/rate-limit.constants';

export interface RateLimitDecision {
  allowed: boolean;
  /** Límite sostenido de la clase (header `RateLimit-Limit`). */
  limit: number;
  /** Tokens restantes (header `RateLimit-Remaining`). */
  remaining: number;
  /** Segundos hasta la reposición (headers `RateLimit-Reset` / `Retry-After`). */
  resetSeconds: number;
  /** Ventana en segundos (header `RateLimit-Policy`). */
  windowSeconds: number;
  rateLimitClass: RateLimitClass;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/**
 * Token bucket por `api_key_id` × clase de operación — §11.
 *
 * El spec dimensiona el limitador sobre Redis (`INCR` + `EXPIRE` con script
 * Lua) y define **fail-open con límite local en memoria por instancia** cuando
 * Redis no está disponible (§11.3). Esta implementación es exactamente ese
 * modo local: Redis no está en el stack aprobado de `AGENTS.md` y el Artículo
 * IV.3 de la constitución prohíbe agregar dependencias sin decision record.
 * `RateLimitStore` aísla el algoritmo del transporte: incorporar Redis es
 * sustituir esta clase, sin tocar guard ni controladores.
 *
 * INV-30: el contador se decrementa **antes** de la lógica de negocio; un 429
 * no toca la BD de negocio, no consume idempotencia y no avanza
 * `response_version`.
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly buckets = new Map<string, Bucket>();
  private readonly inFlight = new Map<string, number>();
  private degradedReported = false;

  constructor(private readonly config: ConfigService) {}

  /** ¿El limitador corre en modo degradado (sin Redis)? (§11.3) */
  get degraded(): boolean {
    return true;
  }

  consume(
    apiKeyId: string,
    rateLimitClass: RateLimitClass,
    environment: string,
    rateTier: string,
    now: number = Date.now(),
  ): RateLimitDecision {
    this.reportDegradedOnce();

    const multiplier = this.tierMultiplier(rateTier);
    const quota = quotaFor(rateLimitClass, environment, multiplier);

    // La cuota de clase y la global se consumen juntas: agotar cualquiera
    // bloquea, pero los contadores por clase siguen siendo independientes
    // entre sí (TS-RL-06).
    const globalQuota = quotaFor(
      RateLimitClass.GLOBAL,
      environment,
      multiplier,
    );

    const classDecision = this.peek(
      `${apiKeyId}:${rateLimitClass}`,
      quota,
      now,
    );
    const globalDecision = this.peek(
      `${apiKeyId}:${RateLimitClass.GLOBAL}`,
      globalQuota,
      now,
    );

    if (!classDecision.allowed || !globalDecision.allowed) {
      const blocking = !classDecision.allowed ? classDecision : globalDecision;
      return {
        allowed: false,
        limit: quota.limit,
        remaining: 0,
        resetSeconds: blocking.resetSeconds,
        windowSeconds: quota.windowSeconds,
        rateLimitClass,
      };
    }

    this.commit(`${apiKeyId}:${rateLimitClass}`, quota, now);
    this.commit(`${apiKeyId}:${RateLimitClass.GLOBAL}`, globalQuota, now);

    return {
      allowed: true,
      limit: quota.limit,
      remaining: Math.max(0, Math.floor(classDecision.remaining - 1)),
      resetSeconds: classDecision.resetSeconds,
      windowSeconds: quota.windowSeconds,
      rateLimitClass,
    };
  }

  /** Concurrencia: máximo 20 peticiones in-flight por key (§11.1). */
  acquireSlot(apiKeyId: string): boolean {
    const current = this.inFlight.get(apiKeyId) ?? 0;
    if (current >= MAX_IN_FLIGHT_PER_KEY) {
      return false;
    }
    this.inFlight.set(apiKeyId, current + 1);
    return true;
  }

  releaseSlot(apiKeyId: string): void {
    const current = this.inFlight.get(apiKeyId) ?? 0;
    if (current <= 1) {
      this.inFlight.delete(apiKeyId);
      return;
    }
    this.inFlight.set(apiKeyId, current - 1);
  }

  /** Solo para pruebas: reinicia el estado local. */
  reset(): void {
    this.buckets.clear();
    this.inFlight.clear();
  }

  private peek(
    bucketKey: string,
    quota: RateLimitQuota,
    now: number,
  ): { allowed: boolean; remaining: number; resetSeconds: number } {
    const capacity = quota.limit + quota.burst;
    const refillPerMs = quota.limit / (quota.windowSeconds * 1000);
    const bucket = this.buckets.get(bucketKey) ?? {
      tokens: capacity,
      updatedAt: now,
    };

    const refilled = Math.min(
      capacity,
      bucket.tokens + (now - bucket.updatedAt) * refillPerMs,
    );

    if (refilled >= 1) {
      return {
        allowed: true,
        remaining: refilled,
        resetSeconds: this.resetSeconds(refilled, capacity, refillPerMs),
      };
    }

    // Segundos hasta que haya un token disponible otra vez.
    const waitMs = (1 - refilled) / refillPerMs;
    return {
      allowed: false,
      remaining: 0,
      resetSeconds: Math.max(1, Math.ceil(waitMs / 1000)),
    };
  }

  private commit(bucketKey: string, quota: RateLimitQuota, now: number): void {
    const capacity = quota.limit + quota.burst;
    const refillPerMs = quota.limit / (quota.windowSeconds * 1000);
    const bucket = this.buckets.get(bucketKey) ?? {
      tokens: capacity,
      updatedAt: now,
    };

    const refilled = Math.min(
      capacity,
      bucket.tokens + (now - bucket.updatedAt) * refillPerMs,
    );

    this.buckets.set(bucketKey, {
      tokens: refilled - 1,
      updatedAt: now,
    });
  }

  private resetSeconds(
    tokens: number,
    capacity: number,
    refillPerMs: number,
  ): number {
    const missing = capacity - tokens;
    if (missing <= 0) {
      return 0;
    }
    return Math.max(1, Math.ceil(missing / refillPerMs / 1000));
  }

  private tierMultiplier(rateTier: string): number {
    const raw = this.config.get<string>(
      `MEP_RATE_TIER_${rateTier.toUpperCase()}_MULTIPLIER`,
    );
    const parsed = raw === undefined ? NaN : Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  private reportDegradedOnce(): void {
    if (this.degradedReported) {
      return;
    }
    this.degradedReported = true;
    // Alerta `rate_limiter_degraded` de §11.3.
    this.logger.warn(
      'rate_limiter_degraded: limitador operando con estado local por instancia (sin Redis).',
    );
  }
}
