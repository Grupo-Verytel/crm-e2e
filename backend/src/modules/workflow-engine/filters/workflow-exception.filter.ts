import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { WorkflowGuardRejectedException } from '../exceptions/workflow-guard-rejected.exception';
import { WorkflowRuleNotFoundException } from '../exceptions/workflow-rule-not-found.exception';

/**
 * Maps workflow-engine exceptions to the HTTP shape in spec §4.5.
 */
@Catch(WorkflowGuardRejectedException, WorkflowRuleNotFoundException)
export class WorkflowExceptionFilter implements ExceptionFilter {
  catch(
    exception: WorkflowGuardRejectedException | WorkflowRuleNotFoundException,
    host: ArgumentsHost,
  ): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof WorkflowGuardRejectedException) {
      response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        codigo_error: exception.codigoError,
        guard: exception.guard,
        detalle: exception.detalle,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      codigo_error: exception.codigoError,
      event_type: exception.eventType,
      detalle: exception.message,
    });
  }
}
