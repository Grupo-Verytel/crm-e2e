import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import {
  Op,
  QueryTypes,
  Sequelize,
  Transaction,
  UniqueConstraintError,
  WhereOptions,
} from 'sequelize';
import { AccountsService } from '../../accounts/services/accounts.service';
import { User } from '../../auth/models/user.model';
import { UsersService } from '../../auth/services/users.service';
import { EntityType } from '../../workflow-engine/enums/entity-type.enum';
import { StatusHistoryTrigger } from '../../workflow-engine/lib/status-history-trigger';
import { StatusHistoryService } from '../../workflow-engine/services/status-history.service';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import {
  DEMAND_GENERATION_ERROR_CODES,
  DEMAND_GENERATION_ROLES,
} from '../constants/demand-generation.constants';
import { CreateLeadDto } from '../dtos/create-lead.dto';
import { DirectChecklistDto } from '../dtos/lead-contact.dto';
import {
  LeadResponseDto,
  LeadsQueryDto,
  PaginatedLeadsResponseDto,
} from '../dtos/lead-response.dto';
import { RecycleLeadDto } from '../dtos/recycle-lead.dto';
import { RegisterAppointmentDto } from '../dtos/register-appointment.dto';
import { UpdateLeadDto } from '../dtos/update-lead.dto';
import {
  allChecklistCriteriaMet,
  computeChecklistResult,
  missingChecklistCriteria,
} from '../lib/checklist-result';
import { canRecycleLead } from '../lib/lead-state-machine';
import { normalizePhoneToE164 } from '../lib/phone-normalize';
import {
  CanalOrigen,
  LeadEstado,
  OrigenLead,
  TipoLead,
} from '../models/enums/lead.enums';
import { MqlEstado } from '../models/enums/mql.enums';
import { SqlOrigenCreacion } from '../models/enums/sql-origen.enum';
import { SqlEstado } from '../models/enums/sql.enums';
import { Segmento } from '../models/enums/segment.enum';
import { LeadChecklist } from '../models/lead-checklist.model';
import { LeadContact } from '../models/lead-contact.model';
import { Lead } from '../models/lead.model';
import { Mql } from '../models/mql.model';
import { Segment } from '../models/segment.model';
import { Sql } from '../models/sql.model';
import { Subsegment } from '../models/subsegment.model';
import {
  NOTIFICATION_PORT,
  NotificationEvent,
} from '../ports/notification.port';
import type { NotificationPort } from '../ports/notification.port';
import { CampaignsService } from './campaigns.service';

type PersonEnrichment = {
  person_id: string;
  name: string;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  account_id: string;
  account_name: string;
  account_tax_id: string | null;
};

@Injectable()
export class LeadsService {
  constructor(
    @InjectModel(Lead) private readonly leadModel: typeof Lead,
    @InjectModel(LeadContact)
    private readonly leadContactModel: typeof LeadContact,
    @InjectModel(Mql) private readonly mqlModel: typeof Mql,
    @InjectModel(Sql) private readonly sqlModel: typeof Sql,
    @InjectModel(LeadChecklist)
    private readonly checklistModel: typeof LeadChecklist,
    @InjectModel(Segment) private readonly segmentModel: typeof Segment,
    @InjectModel(Subsegment) private readonly subsegmentModel: typeof Subsegment,
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly campaignsService: CampaignsService,
    private readonly usersService: UsersService,
    private readonly accountsService: AccountsService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly statusHistory: StatusHistoryService,
    @Inject(NOTIFICATION_PORT)
    private readonly notifications: NotificationPort,
  ) {}

  async create(
    dto: CreateLeadDto,
    createdBy: string,
    roleName?: string,
  ): Promise<LeadResponseDto> {
    if (roleName === DEMAND_GENERATION_ROLES.TRADUCTOR_DE_NEGOCIO) {
      throw new ForbiddenException({
        code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
        message: 'TraductorDeNegocio cannot create leads',
      });
    }

    this.assertB2bIndustria(dto.segmento, dto.industria);
    await this.ensureUserExists(dto.responsable_id);

    if (dto.campana_id) {
      await this.campaignsService.assertCampaignAcceptsLeads(dto.campana_id);
    }

    const personIds = dto.contacts.map((contact) => contact.person_id);
    await this.accountsService.assertPeopleSameAccount(personIds);

    const businessReferrerId = await this.resolveBusinessReferrerId(dto);
    await this.validateSegmentSubsegment(dto.segment_id, dto.subsegment_id);

    const contacts = dto.contacts.map((contact, index) => ({
      position: index + 1,
      personId: contact.person_id,
    }));

    const peopleMap =
      await this.accountsService.getPeopleWithAccounts(personIds);
    const primaryPerson = peopleMap.get(personIds[0]);
    const nit = dto.nit ?? primaryPerson?.account_tax_id ?? null;

    try {
      if (roleName === DEMAND_GENERATION_ROLES.PRODUCT_MANAGER) {
        return await this.createProductManagerLead(
          dto,
          createdBy,
          contacts,
          businessReferrerId,
          nit,
        );
      }

      if (roleName === DEMAND_GENERATION_ROLES.EJECUTIVO_COMERCIAL) {
        return await this.createEjecutivoComercialLead(
          dto,
          createdBy,
          contacts,
          businessReferrerId,
          nit,
        );
      }

      return await this.createStandardLead(
        dto,
        createdBy,
        contacts,
        businessReferrerId,
        nit,
      );
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new ConflictException({
          code: DEMAND_GENERATION_ERROR_CODES.DUPLICATE_NIT,
          message: 'NIT already exists',
        });
      }

      throw error;
    }
  }

  async findAll(
    query: LeadsQueryDto,
    actorUserId?: string,
    roleName?: string,
  ): Promise<PaginatedLeadsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const where: WhereOptions<Lead> = {};

    if (roleName === DEMAND_GENERATION_ROLES.TRADUCTOR_DE_NEGOCIO) {
      where.businessReferrerId = actorUserId;
    }

    if (query.estado) {
      where.estado = query.estado;
    }

    if (query.segmento) {
      where.segmento = query.segmento;
    }

    if (query.canal_origen) {
      where.canalOrigen = query.canal_origen;
    }

    if (query.responsable_id) {
      where.responsableId = query.responsable_id;
    }

    if (query.campana_id) {
      where.campanaId = query.campana_id;
    }

    if (query.from || query.to) {
      where.fechaCaptura = {
        ...(query.from ? { [Op.gte]: new Date(query.from) } : {}),
        ...(query.to ? { [Op.lte]: new Date(query.to) } : {}),
      };
    }

    const { rows, count } = await this.leadModel.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'responsable',
          attributes: ['userId', 'fullName'],
        },
        {
          model: LeadContact,
          as: 'contacts',
          separate: true,
          order: [['position', 'ASC']],
        },
      ],
      order: [['fechaCaptura', 'DESC']],
      limit,
      offset,
    });

    const allPersonIds = rows.flatMap(
      (lead) => lead.contacts?.map((contact) => contact.personId) ?? [],
    );
    const peopleMap =
      await this.accountsService.getPeopleWithAccounts(allPersonIds);

    return {
      items: await Promise.all(
        rows.map((lead) => this.toResponseDto(lead, peopleMap)),
      ),
      total: count,
      page,
      limit,
    };
  }

  async findById(
    leadId: string,
    actorUserId?: string,
    roleName?: string,
  ): Promise<LeadResponseDto> {
    const lead = await this.findLeadOrFail(leadId);
    this.assertTraductorCanAccessLead(lead, actorUserId, roleName);
    return this.toResponseDto(lead);
  }

  async update(leadId: string, dto: UpdateLeadDto): Promise<LeadResponseDto> {
    const lead = await this.findLeadOrFail(leadId);

    if (lead.estado === LeadEstado.MqlPending) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.LEAD_LOCKED,
        message:
          'A lead in MQL_PENDING is read-only until the Director decides (DG-10)',
      });
    }

    const previousCampanaId = lead.campanaId;
    const nextSegmento = dto.segmento ?? lead.segmento;
    const nextIndustria =
      dto.industria !== undefined ? dto.industria : lead.industria;

    this.assertB2bIndustria(nextSegmento, nextIndustria);

    if (dto.responsable_id) {
      await this.ensureUserExists(dto.responsable_id);
    }

    if (dto.campana_id) {
      await this.campaignsService.assertCampaignAcceptsLeads(dto.campana_id);
    }

    const nextSegmentId =
      dto.segment_id !== undefined ? dto.segment_id : lead.segmentId;
    const nextSubsegmentId =
      dto.subsegment_id !== undefined ? dto.subsegment_id : lead.subsegmentId;
    await this.validateSegmentSubsegment(nextSegmentId, nextSubsegmentId);

    try {
      await lead.update({
        ...(dto.tipo_lead !== undefined ? { tipoLead: dto.tipo_lead } : {}),
        ...(dto.origen !== undefined ? { origen: dto.origen } : {}),
        ...(dto.sub_origen !== undefined ? { subOrigen: dto.sub_origen } : {}),
        ...(dto.campana_id !== undefined ? { campanaId: dto.campana_id } : {}),
        ...(dto.segmento !== undefined ? { segmento: dto.segmento } : {}),
        ...(dto.industria !== undefined ? { industria: dto.industria } : {}),
        ...(dto.region !== undefined ? { region: dto.region } : {}),
        ...(dto.pais !== undefined ? { pais: dto.pais.toUpperCase() } : {}),
        ...(dto.nit !== undefined ? { nit: dto.nit } : {}),
        ...(dto.segment_id !== undefined ? { segmentId: dto.segment_id } : {}),
        ...(dto.subsegment_id !== undefined
          ? { subsegmentId: dto.subsegment_id }
          : {}),
        ...(dto.responsable_id !== undefined
          ? { responsableId: dto.responsable_id }
          : {}),
        ...(dto.icp_score !== undefined ? { icpScore: dto.icp_score } : {}),
        ...(dto.utm_source !== undefined ? { utmSource: dto.utm_source } : {}),
        ...(dto.utm_medium !== undefined ? { utmMedium: dto.utm_medium } : {}),
        ...(dto.utm_campaign !== undefined
          ? { utmCampaign: dto.utm_campaign }
          : {}),
      });

      if (dto.campana_id && dto.campana_id !== previousCampanaId) {
        await this.campaignsService.incrementLeadCount(dto.campana_id);
      }

      return this.toResponseDto(lead);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new ConflictException({
          code: DEMAND_GENERATION_ERROR_CODES.DUPLICATE_NIT,
          message: 'NIT already exists',
        });
      }

      throw error;
    }
  }

  async recycle(leadId: string, dto: RecycleLeadDto): Promise<LeadResponseDto> {
    const lead = await this.findLeadOrFail(leadId);

    if (!canRecycleLead(lead.estado)) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.RECYCLE_NOT_ALLOWED,
        message: 'Only discarded leads can be recycled',
      });
    }

    await this.ensureUserExists(dto.responsable_id);

    await lead.update({
      estado: LeadEstado.MOFU,
      responsableId: dto.responsable_id,
      motivoDescarte: null,
    });
    await this.statusHistory.record({
      entityType: EntityType.LEAD,
      entityId: lead.leadId,
      rootLeadId: lead.leadId,
      fromEstado: LeadEstado.Descartado,
      toEstado: LeadEstado.MOFU,
      trigger: StatusHistoryTrigger.Recycle,
      changedBy: dto.responsable_id,
    });

    return this.toResponseDto(lead);
  }

  async registerAppointment(
    leadId: string,
    dto: RegisterAppointmentDto,
    userId: string,
    roleName?: string,
  ): Promise<LeadResponseDto> {
    if (
      roleName !== DEMAND_GENERATION_ROLES.SOPORTE_COMERCIAL &&
      roleName !== DEMAND_GENERATION_ROLES.GESTOR_MERCADEO &&
      roleName !== 'Admin'
    ) {
      throw new ForbiddenException({
        code: DEMAND_GENERATION_ERROR_CODES.APPOINTMENT_NOT_ALLOWED,
        message:
          'Only SoporteComercial or GestorMercadeo can register appointments for agency leads',
      });
    }

    const lead = await this.findLeadOrFail(leadId);

    if (lead.canalOrigen !== CanalOrigen.GeneracionDemandaAgencia) {
      throw new ConflictException({
        code: DEMAND_GENERATION_ERROR_CODES.APPOINTMENT_NOT_ALLOWED,
        message:
          'Appointments can only be registered for GENERACION_DEMANDA_AGENCIA leads',
      });
    }

    if (lead.estado !== LeadEstado.MOFU) {
      throw new ConflictException({
        code: DEMAND_GENERATION_ERROR_CODES.APPOINTMENT_NOT_ALLOWED,
        message: 'The lead must be in MOFU to register an appointment',
      });
    }

    await this.ensureUserExists(dto.comercial_asignado_id);
    const isEligibleCommercial = await this.usersService.isActiveWithRole(
      dto.comercial_asignado_id,
      DEMAND_GENERATION_ROLES.EJECUTIVO_COMERCIAL,
    );

    if (!isEligibleCommercial) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
        message:
          'comercial_asignado_id must reference an active EjecutivoComercial',
      });
    }

    await this.sequelize.transaction(async (transaction) => {
      const existingMql = await this.mqlModel.findOne({
        where: { leadId },
        transaction,
      });

      if (existingMql) {
        await existingMql.update(
          {
            checklistId: null,
            calificadoPor: userId,
            fechaCalificacion: new Date(),
            estado: MqlEstado.Activo,
          },
          { transaction },
        );
      } else {
        await this.mqlModel.create(
          {
            leadId,
            checklistId: null,
            calificadoPor: userId,
            fechaCalificacion: new Date(),
            estado: MqlEstado.Activo,
          },
          { transaction },
        );
      }

      await lead.update(
        {
          citaAgendada: true,
          fechaCita: new Date(dto.fecha_cita),
          comercialAsignadoId: dto.comercial_asignado_id,
          estado: LeadEstado.MqlPending,
        },
        { transaction },
      );
      await this.statusHistory.record({
        entityType: EntityType.LEAD,
        entityId: lead.leadId,
        rootLeadId: lead.leadId,
        fromEstado: LeadEstado.MOFU,
        toEstado: LeadEstado.MqlPending,
        trigger: StatusHistoryTrigger.Advance,
        changedBy: userId,
        transaction,
      });
    });

    const label = await this.getLeadDisplayLabel(lead);
    await this.notifications.notify({
      event: NotificationEvent.AppointmentScheduled,
      recipientUserId: dto.comercial_asignado_id,
      message: `Appointment scheduled for lead ${label}`,
      metadata: { leadId: lead.leadId, fechaCita: dto.fecha_cita },
    });

    return this.toResponseDto(lead);
  }

  async persistIcpScore(
    leadId: string,
    icpScore: number,
  ): Promise<LeadResponseDto> {
    if (icpScore < 0 || icpScore > 100) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
        message: 'icp_score must be between 0 and 100',
      });
    }

    const lead = await this.findLeadOrFail(leadId);
    await lead.update({ icpScore });
    return this.toResponseDto(lead);
  }

  async importLeadRow(
    values: Record<string, string>,
    createdBy: string,
  ): Promise<Lead> {
    const segmento = values.segmento as Segmento;
    const industria = values.industria || null;
    const canalOrigen = values.canal_origen as CanalOrigen;
    const accountName =
      values.account_name?.trim() || values.empresa_nombre?.trim() || '';
    const taxId = values.tax_id?.trim() || values.nit?.trim() || null;

    if (!Object.values(Segmento).includes(segmento)) {
      throw new BadRequestException(`Invalid segmento: ${values.segmento}`);
    }

    if (segmento === Segmento.B2B && !industria) {
      throw new BadRequestException('industria is required for B2B segment');
    }

    if (!Object.values(CanalOrigen).includes(canalOrigen)) {
      throw new BadRequestException(
        `Invalid canal_origen: ${values.canal_origen}`,
      );
    }

    if (!values.region || !values.pais || !accountName || !values.contacto_nombre) {
      throw new BadRequestException('Missing required lead fields');
    }

    if (!values.email?.trim()) {
      throw new BadRequestException('Missing email');
    }

    await this.ensureUserExists(values.responsable_id);

    const telefono = values.telefono
      ? normalizePhoneToE164(values.telefono)
      : null;

    const { person_id: personId } =
      await this.accountsService.findOrCreateAccountAndPerson({
        account_name: accountName,
        tax_id: taxId,
        person_name: values.contacto_nombre.trim(),
        job_title: values.cargo?.trim() || null,
        email: values.email.trim().toLowerCase(),
        phone: telefono,
      });

    return this.sequelize.transaction(async (transaction) => {
      const lead = await this.leadModel.create(
        {
          tipoLead: (values.tipo_lead as TipoLead) || TipoLead.Outbound,
          origen: (values.origen as OrigenLead) || OrigenLead.Email,
          canalOrigen,
          campanaId: values.campana_id || null,
          segmento,
          industria,
          region: values.region,
          pais: values.pais.toUpperCase(),
          nit: taxId,
          responsableId: values.responsable_id,
          estado: this.resolveInitialState(canalOrigen),
          createdBy,
        },
        { transaction },
      );

      await this.leadContactModel.create(
        {
          leadId: lead.leadId,
          position: 1,
          personId,
        },
        { transaction },
      );

      await this.recordLeadCreated(
        lead.leadId,
        lead.estado,
        createdBy,
        transaction,
      );

      return lead;
    });
  }

  async findDuplicateByEmailAndNit(
    email: string,
    nit: string | null,
  ): Promise<Lead | null> {
    if (!email?.trim() || !nit?.trim()) {
      return null;
    }

    const rows = await this.sequelize.query<{ lead_id: string }>(
      `
        SELECT l.lead_id
        FROM leads l
        INNER JOIN lead_contacts lc
          ON lc.lead_id = l.lead_id
          AND lc.position = 1
          AND lc.deleted_at IS NULL
        INNER JOIN people p
          ON p.person_id = lc.person_id
          AND p.deleted_at IS NULL
        INNER JOIN accounts a
          ON a.account_id = p.account_id
          AND a.deleted_at IS NULL
        WHERE LOWER(p.email) = :email
          AND a.tax_id = :nit
          AND l.deleted_at IS NULL
        LIMIT 1
      `,
      {
        replacements: { email: email.trim().toLowerCase(), nit: nit.trim() },
        type: QueryTypes.SELECT,
      },
    );

    if (rows.length === 0) {
      return null;
    }

    return this.leadModel.findByPk(rows[0].lead_id);
  }

  async getLeadDisplayLabel(lead: Lead): Promise<string> {
    const primaryContact =
      lead.contacts?.find((contact) => contact.position === 1) ??
      lead.contacts?.[0];

    if (!primaryContact) {
      const loaded = await this.findLeadOrFail(lead.leadId);
      const contact =
        loaded.contacts?.find((item) => item.position === 1) ??
        loaded.contacts?.[0];
      if (!contact) {
        return 'Lead';
      }
      const people = await this.accountsService.getPeopleWithAccounts([
        contact.personId,
      ]);
      const enriched = people.get(contact.personId);
      return enriched?.account_name ?? enriched?.name ?? 'Lead';
    }

    const people = await this.accountsService.getPeopleWithAccounts([
      primaryContact.personId,
    ]);
    const enriched = people.get(primaryContact.personId);
    return enriched?.account_name ?? enriched?.name ?? 'Lead';
  }

  resolveInitialState(canalOrigen: CanalOrigen): LeadEstado {
    if (canalOrigen === CanalOrigen.GeneracionDemandaAgencia) {
      return LeadEstado.MOFU;
    }

    if (canalOrigen === CanalOrigen.TraductorNegocio) {
      throw new ConflictException({
        code: DEMAND_GENERATION_ERROR_CODES.INVALID_TRANSITION,
        message:
          'TRADUCTOR_NEGOCIO flow requires EjecutivoComercial direct creation',
      });
    }

    return LeadEstado.TOFU;
  }

  async toResponseDto(
    lead: Lead,
    peopleMap?: Map<string, PersonEnrichment>,
  ): Promise<LeadResponseDto> {
    const personIds = lead.contacts?.map((contact) => contact.personId) ?? [];
    const map =
      peopleMap ??
      (await this.accountsService.getPeopleWithAccounts(personIds));
    const primaryContact =
      lead.contacts?.find((contact) => contact.position === 1) ??
      lead.contacts?.[0];
    const primaryEnriched = primaryContact
      ? map.get(primaryContact.personId)
      : undefined;

    return {
      lead_id: lead.leadId,
      tipo_lead: lead.tipoLead,
      origen: lead.origen,
      canal_origen: lead.canalOrigen,
      sub_origen: lead.subOrigen,
      campana_id: lead.campanaId,
      segmento: lead.segmento,
      industria: lead.industria,
      region: lead.region,
      pais: lead.pais,
      empresa_nombre: primaryEnriched?.account_name ?? '',
      nit: primaryEnriched?.account_tax_id ?? lead.nit,
      contacto_nombre: primaryEnriched?.name ?? '',
      cargo: primaryEnriched?.job_title ?? null,
      email: primaryEnriched?.email ?? '',
      telefono: primaryEnriched?.phone ?? null,
      contacts:
        lead.contacts?.map((contact) => {
          const enriched = map.get(contact.personId);
          return {
            contact_id: contact.contactId,
            position: contact.position,
            person_id: contact.personId,
            name: enriched?.name ?? '',
            job_title: enriched?.job_title ?? null,
            email: enriched?.email ?? null,
            phone: enriched?.phone ?? null,
            account_id: enriched?.account_id ?? '',
            account_name: enriched?.account_name ?? '',
            account_tax_id: enriched?.account_tax_id ?? null,
          };
        }) ?? [],
      business_referrer_id: lead.businessReferrerId,
      segment_id: lead.segmentId,
      subsegment_id: lead.subsegmentId,
      tipo_influencia: lead.tipoInfluencia,
      estado: lead.estado,
      icp_score: lead.icpScore,
      responsable_id: lead.responsableId,
      responsable_nombre: lead.responsable?.fullName ?? null,
      cita_agendada: lead.citaAgendada,
      fecha_cita: lead.fechaCita,
      comercial_asignado_id: lead.comercialAsignadoId,
      motivo_descarte: lead.motivoDescarte,
      utm_source: lead.utmSource,
      utm_medium: lead.utmMedium,
      utm_campaign: lead.utmCampaign,
      fecha_captura: lead.fechaCaptura,
      fecha_ultima_interaccion: lead.fechaUltimaInteraccion,
      created_by: lead.createdBy,
      created_at: lead.createdAt,
      updated_at: lead.updatedAt,
    };
  }

  private async createStandardLead(
    dto: CreateLeadDto,
    createdBy: string,
    contacts: Array<{ position: number; personId: string }>,
    businessReferrerId: string | null,
    nit: string | null,
  ): Promise<LeadResponseDto> {
    const initialState = this.resolveInitialState(dto.canal_origen);

    const leadId = await this.sequelize.transaction(async (transaction) => {
      const lead = await this.leadModel.create(
        {
          tipoLead: dto.tipo_lead,
          origen: dto.origen,
          canalOrigen: dto.canal_origen,
          subOrigen: dto.sub_origen ?? null,
          campanaId: dto.campana_id ?? null,
          segmento: dto.segmento,
          industria: dto.industria ?? null,
          segmentId: dto.segment_id ?? null,
          subsegmentId: dto.subsegment_id ?? null,
          region: dto.region,
          pais: dto.pais.toUpperCase(),
          nit,
          businessReferrerId,
          responsableId: dto.responsable_id,
          utmSource: dto.utm_source ?? null,
          utmMedium: dto.utm_medium ?? null,
          utmCampaign: dto.utm_campaign ?? null,
          estado: initialState,
          createdBy,
        },
        { transaction },
      );

      await Promise.all(
        contacts.map((contact) =>
          this.leadContactModel.create(
            { ...contact, leadId: lead.leadId },
            { transaction },
          ),
        ),
      );

      await this.recordLeadCreated(
        lead.leadId,
        lead.estado,
        createdBy,
        transaction,
      );

      return lead.leadId;
    });

    if (dto.campana_id) {
      await this.campaignsService.incrementLeadCount(dto.campana_id);
    }

    const createdLead = await this.findLeadOrFail(leadId);
    return this.toResponseDto(createdLead);
  }

  private async createProductManagerLead(
    dto: CreateLeadDto,
    createdBy: string,
    contacts: Array<{ position: number; personId: string }>,
    businessReferrerId: string | null,
    nit: string | null,
  ): Promise<LeadResponseDto> {
    this.assertDirectRouteCanal(dto.canal_origen, [
      CanalOrigen.BTL,
      CanalOrigen.Fabrica,
    ]);
    const checklist = this.assertDirectChecklistComplete(dto.checklist);

    const leadId = await this.sequelize.transaction(async (transaction) => {
      const lead = await this.leadModel.create(
        {
          tipoLead: dto.tipo_lead,
          origen: dto.origen,
          canalOrigen: dto.canal_origen,
          subOrigen: dto.sub_origen ?? null,
          campanaId: dto.campana_id ?? null,
          segmento: dto.segmento,
          industria: dto.industria ?? null,
          segmentId: dto.segment_id ?? null,
          subsegmentId: dto.subsegment_id ?? null,
          region: dto.region,
          pais: dto.pais.toUpperCase(),
          nit,
          businessReferrerId,
          responsableId: dto.responsable_id,
          utmSource: dto.utm_source ?? null,
          utmMedium: dto.utm_medium ?? null,
          utmCampaign: dto.utm_campaign ?? null,
          estado: LeadEstado.MqlPending,
          createdBy,
        },
        { transaction },
      );

      await Promise.all(
        contacts.map((contact) =>
          this.leadContactModel.create(
            { ...contact, leadId: lead.leadId },
            { transaction },
          ),
        ),
      );

      const checklistRow = await this.createDirectChecklist(
        lead.leadId,
        checklist,
        createdBy,
        transaction,
      );

      await this.mqlModel.create(
        {
          leadId: lead.leadId,
          checklistId: checklistRow.checklistId,
          calificadoPor: createdBy,
          fechaCalificacion: new Date(),
          estado: MqlEstado.Activo,
        },
        { transaction },
      );

      await this.recordLeadCreated(
        lead.leadId,
        LeadEstado.MqlPending,
        createdBy,
        transaction,
      );

      return lead.leadId;
    });

    if (dto.campana_id) {
      await this.campaignsService.incrementLeadCount(dto.campana_id);
    }

    const createdLead = await this.findLeadOrFail(leadId);
    const mql = await this.mqlModel.findOne({ where: { leadId } });
    const label = await this.getLeadDisplayLabel(createdLead);
    await this.notifications.notify({
      event: NotificationEvent.MqlPendingReview,
      recipientRole: DEMAND_GENERATION_ROLES.DIRECTOR_MERCADEO,
      message: `New MQL pending review for lead ${label}`,
      metadata: { leadId, mqlId: mql?.mqlId ?? null },
    });

    return this.toResponseDto(createdLead);
  }

  private async createEjecutivoComercialLead(
    dto: CreateLeadDto,
    createdBy: string,
    contacts: Array<{ position: number; personId: string }>,
    businessReferrerId: string | null,
    nit: string | null,
  ): Promise<LeadResponseDto> {
    this.assertDirectRouteCanal(dto.canal_origen, [
      CanalOrigen.BTL,
      CanalOrigen.Fabrica,
      CanalOrigen.TraductorNegocio,
    ]);
    const checklist = this.assertDirectChecklistComplete(dto.checklist);

    const leadId = await this.sequelize.transaction(async (transaction) => {
      const lead = await this.leadModel.create(
        {
          tipoLead: dto.tipo_lead,
          origen: dto.origen,
          canalOrigen: dto.canal_origen,
          subOrigen: dto.sub_origen ?? null,
          campanaId: dto.campana_id ?? null,
          segmento: dto.segmento,
          industria: dto.industria ?? null,
          segmentId: dto.segment_id ?? null,
          subsegmentId: dto.subsegment_id ?? null,
          region: dto.region,
          pais: dto.pais.toUpperCase(),
          nit,
          businessReferrerId,
          responsableId: dto.responsable_id,
          comercialAsignadoId: createdBy,
          utmSource: dto.utm_source ?? null,
          utmMedium: dto.utm_medium ?? null,
          utmCampaign: dto.utm_campaign ?? null,
          estado: LeadEstado.SQL,
          createdBy,
        },
        { transaction },
      );

      await Promise.all(
        contacts.map((contact) =>
          this.leadContactModel.create(
            { ...contact, leadId: lead.leadId },
            { transaction },
          ),
        ),
      );

      const checklistRow = await this.createDirectChecklist(
        lead.leadId,
        checklist,
        createdBy,
        transaction,
      );

      const mql = await this.mqlModel.create(
        {
          leadId: lead.leadId,
          checklistId: checklistRow.checklistId,
          calificadoPor: createdBy,
          fechaCalificacion: new Date(),
          estado: MqlEstado.ConvertidoSQL,
          motivoCalificacion: 'Auto-calificado — creación directa comercial',
        },
        { transaction },
      );

      const sql = await this.sqlModel.create(
        {
          mqlId: mql.mqlId,
          estado: SqlEstado.Asignado,
          enBacklog: false,
          comercialAsignadoId: createdBy,
          origenCreacion: SqlOrigenCreacion.DirectoComercial,
          fechaAsignacion: new Date(),
        },
        { transaction },
      );

      const primaryPersonId = contacts[0]?.personId;
      const peopleMap = primaryPersonId
        ? await this.accountsService.getPeopleWithAccounts([primaryPersonId])
        : new Map();
      const entityLabel =
        (primaryPersonId
          ? peopleMap.get(primaryPersonId)?.account_name
          : null) ?? 'Lead';

      await this.recordLeadCreated(
        lead.leadId,
        LeadEstado.SQL,
        createdBy,
        transaction,
      );

      await this.workflowEngine.transition(
        EntityType.SQL,
        sql.sqlId,
        'sql.creado_directo',
        {
          estadoAnterior: null,
          estadoNuevo: SqlEstado.Asignado,
          entityLabel,
          actorUserId: createdBy,
          payload: {
            leadId: lead.leadId,
            mqlId: mql.mqlId,
            sqlId: sql.sqlId,
            comercial_asignado_id: createdBy,
            origen_creacion: SqlOrigenCreacion.DirectoComercial,
          },
        },
        transaction,
      );

      return lead.leadId;
    });

    if (dto.campana_id) {
      await this.campaignsService.incrementLeadCount(dto.campana_id);
    }

    const createdLead = await this.findLeadOrFail(leadId);
    return this.toResponseDto(createdLead);
  }

  private async resolveBusinessReferrerId(
    dto: CreateLeadDto,
  ): Promise<string | null> {
    if (dto.canal_origen === CanalOrigen.TraductorNegocio) {
      if (!dto.business_referrer_id) {
        throw new BadRequestException({
          code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
          message:
            'business_referrer_id is required when canal_origen is TRADUCTOR_NEGOCIO',
        });
      }

      const isTraductor = await this.usersService.isActiveWithRole(
        dto.business_referrer_id,
        DEMAND_GENERATION_ROLES.TRADUCTOR_DE_NEGOCIO,
      );
      if (!isTraductor) {
        throw new BadRequestException({
          code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
          message:
            'business_referrer_id must reference an active TraductorDeNegocio',
        });
      }

      return dto.business_referrer_id;
    }

    return null;
  }

  private async validateSegmentSubsegment(
    segmentId?: string | null,
    subsegmentId?: string | null,
  ): Promise<void> {
    if (!segmentId && !subsegmentId) {
      return;
    }

    if (subsegmentId && !segmentId) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
        message: 'segment_id is required when subsegment_id is provided',
      });
    }

    if (segmentId) {
      const segment = await this.segmentModel.findOne({
        where: { id: segmentId, active: true },
      });
      if (!segment) {
        throw new BadRequestException({
          code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid or inactive segment_id',
        });
      }
    }

    if (subsegmentId) {
      const subsegment = await this.subsegmentModel.findOne({
        where: { id: subsegmentId, segmentId: segmentId!, active: true },
      });
      if (!subsegment) {
        throw new BadRequestException({
          code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
          message:
            'Invalid or inactive subsegment_id, or it does not belong to segment_id',
        });
      }
    }
  }

  private async recordLeadCreated(
    leadId: string,
    toEstado: string,
    changedBy: string,
    transaction: Transaction,
  ): Promise<void> {
    await this.statusHistory.record({
      entityType: EntityType.LEAD,
      entityId: leadId,
      rootLeadId: leadId,
      fromEstado: null,
      toEstado,
      trigger: StatusHistoryTrigger.Create,
      changedBy,
      transaction,
    });
  }

  private assertDirectRouteCanal(
    canal: CanalOrigen,
    allowed: CanalOrigen[],
  ): void {
    if (!allowed.includes(canal)) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
        message: `canal_origen ${canal} is not allowed for this direct route`,
      });
    }
  }

  private assertDirectChecklistComplete(
    checklist: DirectChecklistDto | undefined,
  ): DirectChecklistDto {
    if (!checklist) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.CHECKLIST_INCOMPLETE,
        message: 'checklist is required for direct lead creation routes',
      });
    }

    const criteria = {
      criterioSectorObjetivo: checklist.criterio_sector_objetivo,
      criterioNecesidadPortafolio: checklist.criterio_necesidad_portafolio,
      criterioAccesoDecisor: checklist.criterio_acceso_decisor,
      criterioPresupuestoIndicios: checklist.criterio_presupuesto_indicios,
    };

    if (!allChecklistCriteriaMet(criteria)) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.CHECKLIST_INCOMPLETE,
        message: `Checklist incomplete. Pending criteria: ${missingChecklistCriteria(
          criteria,
        ).join(', ')}`,
        details: { missing: missingChecklistCriteria(criteria) },
      });
    }

    return checklist;
  }

  private async createDirectChecklist(
    leadId: string,
    checklist: DirectChecklistDto,
    userId: string,
    transaction: Transaction,
  ): Promise<LeadChecklist> {
    const criteria = {
      criterioSectorObjetivo: checklist.criterio_sector_objetivo,
      criterioNecesidadPortafolio: checklist.criterio_necesidad_portafolio,
      criterioAccesoDecisor: checklist.criterio_acceso_decisor,
      criterioPresupuestoIndicios: checklist.criterio_presupuesto_indicios,
    };

    return this.checklistModel.create(
      {
        leadId,
        ...criteria,
        resultado: computeChecklistResult(criteria),
        completadoPor: userId,
        fechaCompletado: new Date(),
      },
      { transaction },
    );
  }

  private assertTraductorCanAccessLead(
    lead: Lead,
    actorUserId?: string,
    roleName?: string,
  ): void {
    if (roleName !== DEMAND_GENERATION_ROLES.TRADUCTOR_DE_NEGOCIO) {
      return;
    }

    if (lead.businessReferrerId !== actorUserId) {
      throw new NotFoundException({
        code: DEMAND_GENERATION_ERROR_CODES.NOT_FOUND,
        message: 'Lead not found',
      });
    }
  }

  private async findLeadOrFail(leadId: string): Promise<Lead> {
    const lead = await this.leadModel.findByPk(leadId, {
      include: [
        {
          model: User,
          as: 'responsable',
          attributes: ['userId', 'fullName'],
        },
        {
          model: LeadContact,
          as: 'contacts',
          separate: true,
          order: [['position', 'ASC']],
        },
      ],
    });

    if (!lead) {
      throw new NotFoundException({
        code: DEMAND_GENERATION_ERROR_CODES.NOT_FOUND,
        message: 'Lead not found',
      });
    }

    return lead;
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const user = await this.userModel.findByPk(userId);

    if (!user) {
      throw new NotFoundException({
        code: DEMAND_GENERATION_ERROR_CODES.USER_NOT_FOUND,
        message: 'User not found',
      });
    }
  }

  private assertB2bIndustria(
    segmento: Segmento,
    industria: string | null | undefined,
  ): void {
    if (segmento === Segmento.B2B && !industria?.trim()) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
        message: 'industria is required when segmento is B2B',
      });
    }
  }
}
