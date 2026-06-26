import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

interface JwtPayload {
  sub: string;
  role: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header',
      });
    }

    const token = authorization.slice('Bearer '.length);

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const user: AuthenticatedUser = {
        userId: payload.sub,
        roleName: payload.role,
      };
      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      });
    }
  }
}
