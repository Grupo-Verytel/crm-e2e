import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { DEMAND_GENERATION_ROLES } from '../constants/demand-generation.constants';

@Injectable()
export class DirectorMercadeoGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;

    if (
      !user ||
      (user.roleName !== DEMAND_GENERATION_ROLES.DIRECTOR_MERCADEO &&
        user.roleName !== 'Admin')
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'DirectorMercadeo or Admin role required',
      });
    }

    return true;
  }
}
