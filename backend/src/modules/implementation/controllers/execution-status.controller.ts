import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { StatusChangeAckDto, StatusChangeDto } from '../dtos/status-change.dto';
import { PmoApiKeyGuard } from '../guards/pmo-api-key.guard';
import { ProjectExecutionService } from '../services/project-execution.service';

/** Inbound webhook for the PMO — API key auth, no JWT. */
@Controller('integrations/execution')
@Public()
@UseGuards(PmoApiKeyGuard)
export class ExecutionStatusController {
  constructor(
    private readonly projectExecutionService: ProjectExecutionService,
  ) {}

  @Post('status-changes')
  async ingest(
    @Body() dto: StatusChangeDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StatusChangeAckDto> {
    const ack = await this.projectExecutionService.registerStatusChange(dto);

    // 202 on first ingestion, 200 on an idempotent replay — contract with the PMO.
    res.status(ack.duplicate ? HttpStatus.OK : HttpStatus.ACCEPTED);
    return ack;
  }
}
