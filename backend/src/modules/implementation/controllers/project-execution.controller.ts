import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import {
  CreatePmoProjectDto,
  PmoProjectCreatedDto,
} from '../dtos/create-pmo-project.dto';
import {
  ProjectExecutionDto,
  ProjectStateHistoryDto,
} from '../dtos/project-execution.dto';
import { ProjectExecutionService } from '../services/project-execution.service';

/** The CRM's door to the PMO project of an OUV: open it, then read its execution. */
@Controller('implementation/projects')
export class ProjectExecutionController {
  constructor(
    private readonly projectExecutionService: ProjectExecutionService,
  ) {}

  /** Opens the delivery project in the PMO. Explicit action, not a side effect of `ganar`. */
  @Post(':ouvId')
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility({ action: 'create', subject: 'Service' })
  createProject(
    @Param('ouvId', ParseUUIDPipe) ouvId: string,
    @Body() dto: CreatePmoProjectDto,
  ): Promise<PmoProjectCreatedDto> {
    return this.projectExecutionService.createPmoProject(ouvId, dto);
  }

  @Get(':ouvId/execution')
  @CheckAbility({ action: 'read', subject: 'Service' })
  getExecution(
    @Param('ouvId', ParseUUIDPipe) ouvId: string,
  ): Promise<ProjectExecutionDto> {
    return this.projectExecutionService.getExecution(ouvId);
  }

  @Get(':ouvId/state-history')
  @CheckAbility({ action: 'read', subject: 'Service' })
  getStateHistory(
    @Param('ouvId', ParseUUIDPipe) ouvId: string,
  ): Promise<ProjectStateHistoryDto> {
    return this.projectExecutionService.getStateHistory(ouvId);
  }
}
