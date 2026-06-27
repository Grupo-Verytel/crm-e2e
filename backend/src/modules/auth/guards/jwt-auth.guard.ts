import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/sequelize';
import { Request } from 'express';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { CaslPermissionRule } from '../casl/casl-permission.interface';
import { AUTH_ERROR_CODES } from '../constants/auth.constants';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { Role, User } from '../models';

interface JwtPayload {
  sub: string;
  role: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    @InjectModel(User) private readonly userModel: typeof User,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.UNAUTHORIZED,
        message: 'Missing or invalid authorization header',
      });
    }

    const token = authorization.slice('Bearer '.length);

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const user = await this.userModel.findByPk(payload.sub, {
        include: [Role],
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException({
          code: AUTH_ERROR_CODES.UNAUTHORIZED,
          message: 'Invalid or expired token',
        });
      }

      const permissions = this.parsePermissions(user.role.permissions);
      const authenticatedUser: AuthenticatedUser = {
        userId: user.userId,
        roleName: user.role.name,
        permissions,
      };

      request.user = authenticatedUser;
      request.ability =
        this.caslAbilityFactory.createForPermissions(permissions);

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.UNAUTHORIZED,
        message: 'Invalid or expired token',
      });
    }
  }

  private parsePermissions(
    permissions: Role['permissions'],
  ): CaslPermissionRule[] {
    if (Array.isArray(permissions)) {
      return permissions as CaslPermissionRule[];
    }

    if (typeof permissions === 'string') {
      return JSON.parse(permissions) as CaslPermissionRule[];
    }

    return [];
  }
}
