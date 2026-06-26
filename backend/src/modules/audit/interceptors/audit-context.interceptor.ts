import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { AuditContextService } from '../context/audit-context.service';
import { SYSTEM_USER_ID } from '../constants/system-user.constants';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  constructor(
    private readonly auditContextService: AuditContextService,
    private readonly configService: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;
    const systemUserId =
      this.configService.get<string>('AUDIT_SYSTEM_USER_ID') ?? SYSTEM_USER_ID;

    const auditContext = {
      usuarioId: user?.userId ?? systemUserId,
      ipAddress: this.extractIpAddress(request),
      userAgent: request.headers['user-agent'] ?? null,
    };

    return new Observable((subscriber) => {
      this.auditContextService.run(auditContext, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (error) => subscriber.error(error),
          complete: () => subscriber.complete(),
        });
      });
    });
  }

  private extractIpAddress(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return request.ip ?? '0.0.0.0';
  }
}
