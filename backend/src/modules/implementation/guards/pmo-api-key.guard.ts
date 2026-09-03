import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

const HEADER = 'x-api-key';

/**
 * Authenticates the PMO webhook. This is machine-to-machine ingress, so it
 * replaces the JWT guard (the route is `@Public()`) instead of layering on it.
 */
@Injectable()
export class PmoApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('PMO_INBOUND_API_KEY');
    const received = context
      .switchToHttp()
      .getRequest<Request>()
      .header(HEADER);

    if (!expected || !received || !this.matches(received, expected)) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: `Missing or invalid ${HEADER} header`,
      });
    }

    return true;
  }

  private matches(received: string, expected: string): boolean {
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
