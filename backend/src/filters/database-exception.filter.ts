import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Response } from 'express';
import { isDatabaseUnavailableError } from '../modules/auth/lib/is-database-unavailable-error';

/**
 * Maps Sequelize / driver connectivity failures to HTTP 503 so clients
 * do not treat infrastructure outages as validation or auth errors.
 */
@Catch()
export class DatabaseExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);

  override catch(exception: unknown, host: ArgumentsHost): void {
    if (!isDatabaseUnavailableError(exception)) {
      super.catch(exception, host);
      return;
    }

    const response = host.switchToHttp().getResponse<Response>();
    this.logger.error(
      'Database unavailable',
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      code: 'SERVICE_UNAVAILABLE',
      message:
        'Database temporarily unavailable. Retry in a moment or check your connection.',
    });
  }
}
