import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { InfluenciaProblemException } from '../exceptions/influencia-problem.exception';

@Catch(InfluenciaProblemException)
export class InfluenciaProblemFilter implements ExceptionFilter {
  catch(exception: InfluenciaProblemException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception.getStatus();
    response
      .status(status)
      .type('application/problem+json')
      .send(exception.getResponse());
  }
}
