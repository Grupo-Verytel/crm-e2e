import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  CHECK_ABILITY_KEY,
  RequiredAbility,
} from '../casl/check-ability.decorator';
import { AUTH_ERROR_CODES } from '../constants/auth.constants';
import { AppAbility } from '../casl/casl-ability.factory';

@Injectable()
export class CaslGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredAbilities = this.reflector.getAllAndOverride<
      RequiredAbility[]
    >(CHECK_ABILITY_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredAbilities || requiredAbilities.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const ability = request.ability as AppAbility | undefined;

    if (!ability) {
      throw new ForbiddenException({
        code: AUTH_ERROR_CODES.FORBIDDEN,
        message: 'Insufficient permissions',
      });
    }

    const isAllowed = requiredAbilities.every(({ action, subject }) =>
      ability.can(action, subject),
    );

    if (!isAllowed) {
      throw new ForbiddenException({
        code: AUTH_ERROR_CODES.FORBIDDEN,
        message: 'Insufficient permissions',
      });
    }

    return true;
  }
}
