import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { RateLimitClass } from '../constants/rate-limit.constants';
import { RATE_LIMIT_CLASS_KEY } from '../decorators/rate-limit-class.decorator';
import { MepProblemException } from '../domain/mep-problem.exception';
import { RateLimitService } from '../services/rate-limit.service';

/**
 * Aplicación de cuotas — §11.
 *
 * Corre **después** del guard de API key (necesita `api_key_id`) y **antes** de
 * cualquier lógica de negocio: un `429` no toca la BD de negocio, no consume
 * idempotencia y no avanza `response_version` (INV-30).
 *
 * Los headers `RateLimit-*` se escriben directamente en la respuesta, de modo
 * que están presentes tanto en 2xx como en 4xx (TS-RL-02).
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const identity = request.mep?.identity;
    if (!identity) {
      // Sin identidad no hay cuota que aplicar; el guard de API key ya decidió.
      return true;
    }

    const rateLimitClass =
      this.reflector.getAllAndOverride<RateLimitClass>(RATE_LIMIT_CLASS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? RateLimitClass.READ_ITEM;

    const decision = this.rateLimitService.consume(
      identity.apiKeyId,
      rateLimitClass,
      identity.environment,
      identity.rateTier,
    );

    response.setHeader('RateLimit-Limit', String(decision.limit));
    response.setHeader('RateLimit-Remaining', String(decision.remaining));
    response.setHeader('RateLimit-Reset', String(decision.resetSeconds));
    response.setHeader(
      'RateLimit-Policy',
      `${decision.limit};w=${decision.windowSeconds}`,
    );

    if (!decision.allowed) {
      throw MepProblemException.rateLimited(
        decision.resetSeconds,
        `Límite de ${decision.limit} req/${decision.windowSeconds}s para la clase '${rateLimitClass}'. Reintente en ${decision.resetSeconds} s.`,
      );
    }

    return true;
  }
}
