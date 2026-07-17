import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { DEMAND_GENERATION_ERROR_CODES } from '../constants/demand-generation.constants';
import {
  BulkImportJobAcceptedDto,
  BulkImportJobStatusDto,
} from '../dtos/bulk-import-job.dto';
import { ChecklistResponseDto } from '../dtos/checklist-response.dto';
import { CommercialOptionDto } from '../dtos/commercial-option.dto';
import { CreateInteractionDto } from '../dtos/create-interaction.dto';
import { CreateLeadDto } from '../dtos/create-lead.dto';
import { DiscardLeadDto } from '../dtos/discard-lead.dto';
import { InteractionResponseDto } from '../dtos/interaction-response.dto';
import {
  LeadResponseDto,
  LeadsQueryDto,
  PaginatedLeadsResponseDto,
} from '../dtos/lead-response.dto';
import { RecycleLeadDto } from '../dtos/recycle-lead.dto';
import { RegisterAppointmentDto } from '../dtos/register-appointment.dto';
import { TransitionToMqlDto } from '../dtos/transition-mql.dto';
import { UpdateChecklistDto } from '../dtos/update-checklist.dto';
import { UpdateLeadDto } from '../dtos/update-lead.dto';
import { DemandGenerationService } from '../services/demand-generation.service';

@Controller('leads')
export class LeadsController {
  constructor(
    private readonly demandGenerationService: DemandGenerationService,
  ) {}

  @Post()
  @CheckAbility({ action: 'create', subject: 'Lead' })
  create(
    @Body() dto: CreateLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LeadResponseDto> {
    return this.demandGenerationService.createLead(dto, user.userId);
  }

  @Post('bulk-import')
  @HttpCode(202)
  @CheckAbility({ action: 'create', subject: 'Lead' })
  @UseInterceptors(FileInterceptor('file'))
  bulkImport(
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): BulkImportJobAcceptedDto {
    if (!file) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
        message: 'CSV file is required',
      });
    }

    return this.demandGenerationService.enqueueLeadImport(
      file.buffer.toString('utf-8'),
      user.userId,
    );
  }

  @Get('bulk-import/:jobId')
  @CheckAbility({ action: 'read', subject: 'Lead' })
  importStatus(@Param('jobId') jobId: string): BulkImportJobStatusDto {
    return this.demandGenerationService.getImportJobStatus(jobId);
  }

  @Get()
  @CheckAbility({ action: 'read', subject: 'Lead' })
  findAll(@Query() query: LeadsQueryDto): Promise<PaginatedLeadsResponseDto> {
    return this.demandGenerationService.listLeads(query);
  }

  @Get('appointment-commercials')
  @CheckAbility({ action: 'schedule', subject: 'Lead' })
  listAppointmentCommercials(): Promise<CommercialOptionDto[]> {
    return this.demandGenerationService.listAppointmentCommercials();
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'Lead' })
  findOne(@Param('id') id: string): Promise<LeadResponseDto> {
    return this.demandGenerationService.findLeadById(id);
  }

  @Put(':id')
  @CheckAbility({ action: 'update', subject: 'Lead' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ): Promise<LeadResponseDto> {
    return this.demandGenerationService.updateLead(id, dto);
  }

  @Post(':id/recycle')
  @CheckAbility({ action: 'update', subject: 'Lead' })
  recycle(
    @Param('id') id: string,
    @Body() dto: RecycleLeadDto,
  ): Promise<LeadResponseDto> {
    return this.demandGenerationService.recycleLead(id, dto);
  }

  @Post(':id/registrar-cita')
  @HttpCode(200)
  @CheckAbility({ action: 'schedule', subject: 'Lead' })
  registerAppointment(
    @Param('id') id: string,
    @Body() dto: RegisterAppointmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LeadResponseDto> {
    return this.demandGenerationService.registerLeadAppointment(
      id,
      dto,
      user.userId,
    );
  }

  @Post(':id/interactions')
  @CheckAbility({ action: 'update', subject: 'Lead' })
  registerInteraction(
    @Param('id') id: string,
    @Body() dto: CreateInteractionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InteractionResponseDto> {
    return this.demandGenerationService.registerInteraction(
      id,
      dto,
      user.userId,
    );
  }

  @Get(':id/interactions')
  @CheckAbility({ action: 'read', subject: 'Lead' })
  listInteractions(@Param('id') id: string): Promise<InteractionResponseDto[]> {
    return this.demandGenerationService.listInteractions(id);
  }

  @Put(':id/checklist')
  @CheckAbility({ action: 'update', subject: 'Lead' })
  updateChecklist(
    @Param('id') id: string,
    @Body() dto: UpdateChecklistDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ChecklistResponseDto> {
    return this.demandGenerationService.updateChecklist(id, dto, user.userId);
  }

  @Get(':id/checklist')
  @CheckAbility({ action: 'read', subject: 'Lead' })
  getChecklist(@Param('id') id: string): Promise<ChecklistResponseDto | null> {
    return this.demandGenerationService.getChecklist(id);
  }

  @Post(':id/transition-to-mofu')
  @HttpCode(200)
  @CheckAbility({ action: 'update', subject: 'Lead' })
  transitionToMofu(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LeadResponseDto> {
    return this.demandGenerationService.transitionLeadToMofu(id, user.userId);
  }

  @Post(':id/transition-to-mql')
  @HttpCode(200)
  @CheckAbility({ action: 'update', subject: 'Lead' })
  transitionToMql(
    @Param('id') id: string,
    @Body() dto: TransitionToMqlDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LeadResponseDto> {
    return this.demandGenerationService.transitionLeadToMql(
      id,
      dto,
      user.userId,
    );
  }

  @Post(':id/discard')
  @HttpCode(200)
  @CheckAbility({ action: 'update', subject: 'Lead' })
  discard(
    @Param('id') id: string,
    @Body() dto: DiscardLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LeadResponseDto> {
    return this.demandGenerationService.discardLead(
      id,
      user.userId,
      dto.motivo,
    );
  }
}
