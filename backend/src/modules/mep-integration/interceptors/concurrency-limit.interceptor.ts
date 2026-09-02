import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MAX_IN_FLIGHT_PER_KEY } from '../constants/rate-limit.constants';
import { MepProblemException } from '../domain/mep-problem.exception';
import { RateLimitService } from '../services/rate-limit.service';

/**
 * Límite de concurrencia — §11.1: 20 peticiones in-flight simultáneas por key.
 *
 * Va como interceptor y no como guard porque el cupo hay que **devolverlo**
 * cuando la petición termina, y un guard no tiene punto de salida. Corre
 * después de los guards y antes del handler, así que sigue cumpliendo INV-30:
 * un rechazo por concurrencia no toca la BD de negocio.
 */
@Injectable()
export class ConcurrencyLimitInterceptor implements NestInterceptor {
  constructor(private readonly rateLimitService: RateLimitService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const identity = request.mep?.identity;

    if (!identity) {
      return next.handle();
    }

    if (!this.rateLimitService.acquireSlot(identity.apiKeyId)) {
      throw MepProblemException.rateLimited(
        1,
        `Máximo de ${MAX_IN_FLIGHT_PER_KEY} peticiones simultáneas por credencial.`,
      );
    }

    return next
      .handle()
      .pipe(
        finalize(() => this.rateLimitService.releaseSlot(identity.apiKeyId)),
      );
  }
}
