import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UsersService } from '../../auth/services/users.service';
import { DEMAND_GENERATION_ROLES } from '../constants/demand-generation.constants';
import { ApproveMqlDto } from '../dtos/approve-mql.dto';
import {
  BulkImportJobAcceptedDto,
  BulkImportJobStatusDto,
} from '../dtos/bulk-import-job.dto';
import {
  CampaignResponseDto,
  CampaignsQueryDto,
  PaginatedCampaignsResponseDto,
} from '../dtos/campaign-response.dto';
import { ChecklistResponseDto } from '../dtos/checklist-response.dto';
import { CommercialOptionDto } from '../dtos/commercial-option.dto';
import { CreateCampaignDto } from '../dtos/create-campaign.dto';
import { CreateInteractionDto } from '../dtos/create-interaction.dto';
import { CreateLeadDto } from '../dtos/create-lead.dto';
import {
  MarketingDashboardQueryDto,
  MarketingDashboardResponseDto,
} from '../dtos/dashboard-response.dto';
import { InteractionResponseDto } from '../dtos/interaction-response.dto';
import {
  LeadResponseDto,
  LeadsQueryDto,
  PaginatedLeadsResponseDto,
} from '../dtos/lead-response.dto';
import {
  ApproveMqlResponseDto,
  MqlResponseDto,
  MqlsQueryDto,
  PaginatedMqlsResponseDto,
} from '../dtos/mql-response.dto';
import { RecycleLeadDto } from '../dtos/recycle-lead.dto';
import { RegisterAppointmentDto } from '../dtos/register-appointment.dto';
import { SegmentResponseDto } from '../dtos/segment-response.dto';
import { RejectMqlDto } from '../dtos/reject-mql.dto';
import { TransitionToMqlDto } from '../dtos/transition-mql.dto';
import { UpdateCampaignStatusDto } from '../dtos/update-campaign-status.dto';
import { UpdateChecklistDto } from '../dtos/update-checklist.dto';
import { UpdateLeadDto } from '../dtos/update-lead.dto';
import { Segment } from '../models/segment.model';
import { Subsegment } from '../models/subsegment.model';
import { CampaignsService } from './campaigns.service';
import { DashboardService } from './dashboard.service';
import { InteractionsService } from './interactions.service';
import { LeadChecklistService } from './lead-checklist.service';
import { LeadImportJobService } from './lead-import-job.service';
import { LeadStateMachineService } from './lead-state-machine.service';
import { LeadsService } from './leads.service';
import { MqlsService } from './mqls.service';

/**
 * Public facade for the demand-generation module. Controllers and other
 * modules interact only with this service (module boundary rule).
 */
@Injectable()
export class DemandGenerationService {
  constructor(
    @InjectModel(Segment) private readonly segmentModel: typeof Segment,
    @InjectModel(Subsegment) private readonly subsegmentModel: typeof Subsegment,
    private readonly leadsService: LeadsService,
    private readonly campaignsService: CampaignsService,
    private readonly interactionsService: InteractionsService,
    private readonly checklistService: LeadChecklistService,
    private readonly stateMachine: LeadStateMachineService,
    private readonly mqlsService: MqlsService,
    private readonly dashboardService: DashboardService,
    private readonly importJobService: LeadImportJobService,
    private readonly usersService: UsersService,
  ) {}

  // ----- Leads -----

  async createLead(
    dto: CreateLeadDto,
    createdBy: string,
    roleName?: string,
  ): Promise<LeadResponseDto> {
    return this.leadsService.create(dto, createdBy, roleName);
  }

  async findLeadById(
    leadId: string,
    actorUserId?: string,
    roleName?: string,
  ): Promise<LeadResponseDto> {
    return this.leadsService.findById(leadId, actorUserId, roleName);
  }

  async updateLead(
    leadId: string,
    dto: UpdateLeadDto,
  ): Promise<LeadResponseDto> {
    return this.leadsService.update(leadId, dto);
  }

  async persistIcpScore(
    leadId: string,
    icpScore: number,
  ): Promise<LeadResponseDto> {
    return this.leadsService.persistIcpScore(leadId, icpScore);
  }

  async listLeads(
    query: LeadsQueryDto,
    actorUserId?: string,
    roleName?: string,
  ): Promise<PaginatedLeadsResponseDto> {
    return this.leadsService.findAll(query, actorUserId, roleName);
  }

  async recycleLead(
    leadId: string,
    dto: RecycleLeadDto,
  ): Promise<LeadResponseDto> {
    return this.leadsService.recycle(leadId, dto);
  }

  async registerLeadAppointment(
    leadId: string,
    dto: RegisterAppointmentDto,
    userId: string,
    roleName?: string,
  ): Promise<LeadResponseDto> {
    return this.leadsService.registerAppointment(leadId, dto, userId, roleName);
  }

  async listAppointmentCommercials(): Promise<CommercialOptionDto[]> {
    const users =
      await this.usersService.findActiveByRoleName('EjecutivoComercial');

    return users.map((user) => ({
      user_id: user.user_id,
      full_name: user.full_name,
    }));
  }

  // ----- Bulk import (async) -----

  enqueueLeadImport(
    csvContent: string,
    createdBy: string,
  ): BulkImportJobAcceptedDto {
    return this.importJobService.enqueue(csvContent, createdBy);
  }

  getImportJobStatus(jobId: string): BulkImportJobStatusDto {
    return this.importJobService.getStatus(jobId);
  }

  // ----- Interactions -----

  async registerInteraction(
    leadId: string,
    dto: CreateInteractionDto,
    responsableId: string,
  ): Promise<InteractionResponseDto> {
    return this.interactionsService.create(leadId, dto, responsableId);
  }

  async listInteractions(leadId: string): Promise<InteractionResponseDto[]> {
    return this.interactionsService.listByLead(leadId);
  }

  // ----- Checklist -----

  async updateChecklist(
    leadId: string,
    dto: UpdateChecklistDto,
    userId: string,
  ): Promise<ChecklistResponseDto> {
    return this.checklistService.upsert(leadId, dto, userId);
  }

  async getChecklist(leadId: string): Promise<ChecklistResponseDto | null> {
    return this.checklistService.findByLead(leadId);
  }

  // ----- Transitions -----

  async transitionLeadToMofu(
    leadId: string,
    userId: string,
  ): Promise<LeadResponseDto> {
    const lead = await this.stateMachine.transitionToMofu(leadId, userId);
    return this.leadsService.toResponseDto(lead);
  }

  async transitionLeadToMql(
    leadId: string,
    dto: TransitionToMqlDto,
    userId: string,
  ): Promise<LeadResponseDto> {
    const checklist = dto.checklist_id
      ? await this.checklistService.findByIdOrFail(dto.checklist_id)
      : await this.checklistService.findLatestOrFail(leadId);

    const { lead } = await this.stateMachine.transitionToMqlPending(
      leadId,
      checklist.checklistId,
      userId,
    );

    return this.leadsService.toResponseDto(lead);
  }

  async discardLead(
    leadId: string,
    userId: string,
    motivo: string,
  ): Promise<LeadResponseDto> {
    const lead = await this.stateMachine.discardLead(leadId, userId, motivo);
    return this.leadsService.toResponseDto(lead);
  }

  async listSegments(): Promise<SegmentResponseDto[]> {
    const segments = await this.segmentModel.findAll({
      where: { active: true },
      include: [
        {
          model: Subsegment,
          as: 'subsegments',
          where: { active: true },
          required: false,
        },
      ],
      order: [
        ['name', 'ASC'],
        [{ model: Subsegment, as: 'subsegments' }, 'name', 'ASC'],
      ],
    });

    return segments.map((segment) => ({
      id: segment.id,
      name: segment.name,
      subsegments:
        segment.subsegments?.map((subsegment) => ({
          id: subsegment.id,
          name: subsegment.name,
        })) ?? [],
    }));
  }

  // ----- Campaigns -----

  async createCampaign(
    dto: CreateCampaignDto,
    roleName?: string,
  ): Promise<CampaignResponseDto> {
    this.assertTraductorCannotWriteCampaigns(roleName);
    return this.campaignsService.create(dto);
  }

  async listCampaigns(
    query: CampaignsQueryDto,
  ): Promise<PaginatedCampaignsResponseDto> {
    return this.campaignsService.findAll(query);
  }

  async updateCampaignStatus(
    campanaId: string,
    dto: UpdateCampaignStatusDto,
    roleName?: string,
  ): Promise<CampaignResponseDto> {
    this.assertTraductorCannotWriteCampaigns(roleName);
    return this.campaignsService.updateStatus(campanaId, dto);
  }

  // ----- MQLs -----

  async listMqls(query: MqlsQueryDto): Promise<PaginatedMqlsResponseDto> {
    return this.mqlsService.findAll(query);
  }

  async approveMql(
    mqlId: string,
    dto: ApproveMqlDto,
    userId: string,
  ): Promise<ApproveMqlResponseDto> {
    return this.mqlsService.approve(mqlId, dto, userId);
  }

  async rejectMql(
    mqlId: string,
    dto: RejectMqlDto,
    userId: string,
  ): Promise<MqlResponseDto> {
    return this.mqlsService.reject(mqlId, dto, userId);
  }

  // ----- Dashboard -----

  async getMarketingDashboard(
    query: MarketingDashboardQueryDto,
  ): Promise<MarketingDashboardResponseDto> {
    return this.dashboardService.getMarketingDashboard(query);
  }

  private assertTraductorCannotWriteCampaigns(roleName?: string): void {
    if (roleName === DEMAND_GENERATION_ROLES.TRADUCTOR_DE_NEGOCIO) {
      throw new ForbiddenException(
        'TraductorDeNegocio cannot create or update campaigns',
      );
    }
  }
}
