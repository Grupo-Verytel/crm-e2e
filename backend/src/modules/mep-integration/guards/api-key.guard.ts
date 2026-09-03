import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { MepScope } from '../constants/scopes';
import { MepProblemException } from '../domain/mep-problem.exception';
import { ApiKeyService } from '../services/api-key.service';
import { REQUIRED_SCOPE_KEY } from '../decorators/require-scope.decorator';

/**
 * Autenticación y autorización del contrato — §5.1 y §10.2.
 *
 * `X-API-Key` exclusivamente por header: si la clave viaja en query string,
 * path, body o cookie, no se lee y la petición es `401` (TS-SEC-07).
 *
 * 401 = clave ausente, malformada, desconocida, revocada, expirada o de otro
 *       ambiente — siempre con cuerpo genérico, sin revelar cuál de los casos.
 * 403 = identidad válida sin el scope requerido (`INSUFFICIENT_SCOPE`).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers['x-api-key'];
    const presented = Array.isArray(header) ? header[0] : header;

    if (!presented) {
      throw MepProblemException.unauthorized('Credencial ausente o inválida.');
    }

    const identity = await this.apiKeyService.verify(presented);

    if (!identity) {
      throw MepProblemException.unauthorized('Credencial ausente o inválida.');
    }

    if (request.mep) {
      request.mep.identity = identity;
    }

    const requiredScope = this.reflector.getAllAndOverride<MepScope>(
      REQUIRED_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredScope && !identity.scopes.includes(requiredScope)) {
      throw MepProblemException.forbidden(
        `La identidad no tiene el scope requerido para esta operación.`,
      );
    }

    return true;
  }
}
