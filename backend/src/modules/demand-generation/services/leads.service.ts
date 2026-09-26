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
  LEAD_IMPORT_DUPLICATE_REASON,
} from '../constants/demand-generation.constants';
import { CreateLeadDto } from '../dtos/create-lead.dto';
import {
  AssignLeadInfluenciaDto,
  DirectChecklistDto,
} from '../dtos/lead-contact.dto';
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
import { normalizeCitaContactos } from '../lib/cita-contactos';
import { resolveReferrerName } from '../lib/lead-referrer';
import { isIndustriaSegmento, resolveSegmentoFromInput } from '../lib/segment-catalog';
import {
  CanalOrigen,
  LeadContactInfluenciaTipo,
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function readContactInfluenciaTipo(
  contact: LeadContact,
): LeadContactInfluenciaTipo | null {
  const plain = (
    typeof contact.toJSON === 'function' ? contact.toJSON() : contact
  ) as {
    tipoInfluencia?: LeadContactInfluenciaTipo | string | null;
    tipo_influencia?: LeadContactInfluenciaTipo | string | null;
  };
  const raw =
    contact.tipoInfluencia ??
    (typeof contact.getDataValue === 'function'
      ? contact.getDataValue('tipoInfluencia')
      : undefined) ??
    plain.tipoInfluencia ??
    plain.tipo_influencia ??
    null;
  if (!raw) {
    return null;
  }
  if (raw === 'DeFabrica') {
    return LeadContactInfluenciaTipo.Fabrica;
  }
  if (raw === 'Usuaria') {
    return LeadContactInfluenciaTipo.Usuario;
  }
  if (
    Object.values(LeadContactInfluenciaTipo).includes(
      raw as LeadContactInfluenciaTipo,
    )
  ) {
    return raw as LeadContactInfluenciaTipo;
  }
  return null;
}

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

    await this.ensureUserExists(dto.responsable_id);

    if (dto.campana_id) {
      await this.campaignsService.assertCampaignAcceptsLeads(dto.campana_id);
    }

    const personIds = dto.contacts.map((contact) => contact.person_id);
    const contactsAccountId =
      await this.accountsService.assertPeopleSameAccount(personIds);
    const accountId = this.resolveLeadAccountId(
      dto.account_id,
      contactsAccountId,
    );

    const businessReferrerId = await this.resolveBusinessReferrerId(dto);
    await this.validateSegmentSubsegment(dto.segment_id, dto.subsegment_id);
    this.assertIndustriaRequiresSubsegment(dto.segmento, dto.subsegment_id);

    const contacts = dto.contacts.map((contact, index) => ({
      position: index + 1,
      personId: contact.person_id,
      tipoInfluencia: contact.tipo_influencia ?? null,
    }));

    const peopleMap =
      await this.accountsService.getPeopleWithAccounts(personIds);
    const primaryPerson = peopleMap.get(personIds[0]);
    const nit = dto.nit ?? primaryPerson?.account_tax_id ?? null;
    const name = await this.resolveUniqueLeadName(
      dto.name,
      primaryPerson?.account_name ?? null,
    );
    const createDto: CreateLeadDto = {
      ...dto,
      name,
      tipo_lead: dto.tipo_lead ?? TipoLead.Inbound,
    };

    try {
      if (roleName === DEMAND_GENERATION_ROLES.PRODUCT_MANAGER) {
        return await this.createProductManagerLead(
          createDto,
          createdBy,
          contacts,
          businessReferrerId,
          nit,
          accountId,
        );
      }

      if (roleName === DEMAND_GENERATION_ROLES.EJECUTIVO_COMERCIAL) {
        return await this.createEjecutivoComercialLead(
          createDto,
          createdBy,
          contacts,
          businessReferrerId,
          nit,
          accountId,
        );
      }

      return await this.createStandardLead(
        createDto,
        createdBy,
        contacts,
        businessReferrerId,
        nit,
        accountId,
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

    if (dto.name !== undefined) {
      await this.assertLeadNameAvailable(dto.name, leadId);
    }

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
    const nextSegmento = dto.segmento ?? lead.segmento;
    await this.validateSegmentSubsegment(nextSegmentId, nextSubsegmentId);
    this.assertIndustriaRequiresSubsegment(nextSegmento, nextSubsegmentId);

    try {
      const nextAccountId =
        dto.account_id !== undefined
          ? await this.resolveAccountIdForUpdate(lead, dto.account_id)
          : undefined;
      await lead.update({
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.tipo_lead !== undefined ? { tipoLead: dto.tipo_lead } : {}),
        ...(dto.origen !== undefined ? { origen: dto.origen } : {}),
        ...(dto.sub_origen !== undefined ? { subOrigen: dto.sub_origen } : {}),
        ...(dto.campana_id !== undefined ? { campanaId: dto.campana_id } : {}),
        ...(nextAccountId !== undefined ? { accountId: nextAccountId } : {}),
        ...(dto.segmento !== undefined ? { segmento: dto.segmento } : {}),
        ...(dto.industria !== undefined ? { industria: dto.industria } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.region !== undefined ? { region: dto.region } : {}),
        ...(dto.pais !== undefined ? { pais: dto.pais.toUpperCase() } : {}),
        ...(dto.nit !== undefined ? { nit: dto.nit } : {}),
        ...(dto.segment_id !== undefined ? { segmentId: dto.segment_id } : {}),
        ...(dto.subsegment_id !== undefined
          ? { subsegmentId: dto.subsegment_id }
          : {}),
        ...(dto.referrer_name !== undefined
          ? {
              referrerName: resolveReferrerName(
                lead.canalOrigen,
                dto.referrer_name,
              ),
            }
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

  async assignInfluencia(
    leadId: string,
    tipo: LeadContactInfluenciaTipo,
    dto: AssignLeadInfluenciaDto,
  ): Promise<LeadResponseDto> {
    const lead = await this.findLeadOrFail(leadId);

    if (lead.estado === LeadEstado.MqlPending) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.LEAD_LOCKED,
        message:
          'A lead in MQL_PENDING is read-only until the Director decides (DG-10)',
      });
    }

    const personId = dto.person_id ?? null;
    const contacts = lead.contacts ?? [];

    if (personId) {
      const existingIds = contacts.map((row) => row.personId);
      const personAccountId =
        await this.accountsService.assertPeopleSameAccount([
          personId,
          ...existingIds,
        ]);
      if (lead.accountId && personAccountId !== lead.accountId) {
        throw new ConflictException({
          code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
          message:
            'Todos los contactos del lead deben pertenecer a la misma empresa.',
        });
      }
    }

    await this.sequelize.transaction(async (transaction) => {
      if (!personId) {
        await Promise.all(
          contacts
            .filter((row) => readContactInfluenciaTipo(row) === tipo)
            .map((row) =>
              row.update({ tipoInfluencia: null }, { transaction }),
            ),
        );
        return;
      }

      if (!lead.accountId) {
        const people = await this.accountsService.getPeopleWithAccounts([
          personId,
        ]);
        const accountId = people.get(personId)?.account_id ?? null;
        if (accountId) {
          await lead.update({ accountId }, { transaction });
        }
      }

      let target = contacts.find((row) => row.personId === personId);
      if (!target) {
        const maxPosition = contacts.reduce(
          (max, row) => Math.max(max, row.position),
          0,
        );
        target = await this.leadContactModel.create(
          {
            leadId,
            personId,
            position: maxPosition + 1,
            tipoInfluencia: tipo,
          },
          { transaction },
        );
      }

      await Promise.all(
        contacts
          .filter(
            (row) =>
              row.contactId !== target.contactId &&
              readContactInfluenciaTipo(row) === tipo,
          )
          .map((row) =>
            row.update({ tipoInfluencia: null }, { transaction }),
          ),
      );

      if (target.tipoInfluencia !== tipo) {
        await target.update({ tipoInfluencia: tipo }, { transaction });
      }
    });

    return this.toResponseDto(await this.findLeadOrFail(leadId));
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
    _userId: string,
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

    await lead.update({
      citaAgendada: true,
      fechaCita: new Date(dto.fecha_cita),
      comercialAsignadoId: dto.comercial_asignado_id,
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
    options?: {
      campanaId?: string;
      canalOrigen?: CanalOrigen;
      allowDuplicate?: boolean;
    },
  ): Promise<Lead> {
    const segmento = resolveSegmentoFromInput(values.segmento) as Segmento;
    const canalOrigen = (options?.canalOrigen ??
      values.canal_origen) as CanalOrigen;
    const origenValue =
      values.origen === 'Email'
        ? OrigenLead.EmailMarketing
        : (values.origen as OrigenLead);
    const accountName =
      values.account_name?.trim() ||
      values.empresa?.trim() ||
      values.empresa_nombre?.trim() ||
      '';
    const { name: resolvedAccountName, taxId: taxIdFromLabel } =
      this.parseImportAccountRef(
        accountName,
        values.tax_id?.trim() || values.nit?.trim() || null,
      );
    const taxId = taxIdFromLabel;
    const { city, region } = this.parseImportCityRegion(
      values.city?.trim() || values.ciudad?.trim() || '',
      values.region?.trim() || '',
    );
    const subsegmentName =
      values.subsegmento?.trim() || values.industria?.trim() || '';

    if (!Object.values(Segmento).includes(segmento)) {
      throw new BadRequestException(`Invalid segmento: ${values.segmento}`);
    }

    if (!Object.values(CanalOrigen).includes(canalOrigen)) {
      throw new BadRequestException(
        `Invalid canal_origen: ${values.canal_origen}`,
      );
    }

    if (!Object.values(OrigenLead).includes(origenValue)) {
      throw new BadRequestException(`Invalid origen: ${values.origen}`);
    }

    if (!city || !region || !resolvedAccountName || !values.contacto_nombre?.trim()) {
      throw new BadRequestException('Missing required lead fields');
    }

    if (!values.email?.trim()) {
      throw new BadRequestException('Missing email');
    }

    const tipoInfluencia = this.parseImportInfluencia(values.tipo_influencia);
    const { segmentId, subsegmentId } = await this.resolveImportSegmentIds(
      segmento,
      subsegmentName,
    );
    this.assertIndustriaRequiresSubsegment(segmento, subsegmentId);

    const responsableId = createdBy;
    const traductorRaw = values.traductor || values.business_referrer_id;
    const resolvedTraductorId = traductorRaw
      ? await this.resolveImportUserId(traductorRaw)
      : undefined;
    const businessReferrerId = await this.resolveBusinessReferrerId({
      canal_origen: canalOrigen,
      business_referrer_id: resolvedTraductorId,
    } as CreateLeadDto);

    const telefono = values.telefono
      ? normalizePhoneToE164(values.telefono)
      : null;
    const email = values.email.trim().toLowerCase();

    const account = await this.accountsService.findExistingAccountForImport(
      resolvedAccountName,
      taxId,
    );
    const duplicate = await this.findDuplicateByAccountIdAndEmail(
      account.account_id,
      email,
    );
    if (duplicate && !options?.allowDuplicate) {
      throw new BadRequestException(LEAD_IMPORT_DUPLICATE_REASON);
    }

    const name = await this.resolveUniqueLeadName(values.name, resolvedAccountName);

    const campaignId =
      options?.campanaId ??
      (await this.resolveImportCampaignId(values.campana || values.campana_id));

    const { person_id: personId, account_id: accountId } =
      await this.accountsService.findOrCreatePersonForAccount(
        account.account_id,
        {
          person_name: values.contacto_nombre.trim(),
          job_title: values.cargo?.trim() || null,
          email,
          phone: telefono,
        },
      );

    const createdLead = await this.sequelize.transaction(async (transaction) => {
      const lead = await this.leadModel.create(
        {
          name,
          tipoLead: (values.tipo_lead as TipoLead) || TipoLead.Inbound,
          origen: origenValue,
          canalOrigen,
          campanaId: campaignId,
          segmento,
          industria: subsegmentName || null,
          segmentId,
          subsegmentId,
          accountId,
          city,
          region,
          pais: (values.pais || 'CO').toUpperCase(),
          nit: taxId,
          businessReferrerId,
          responsableId,
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
          tipoInfluencia,
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

    if (campaignId) {
      await this.campaignsService.incrementLeadCount(campaignId);
    }

    return createdLead;
  }

  /**
   * Adds another contact from a repeated Empresa + NIT row onto a lead
   * that this import already created or found.
   */
  async attachImportContactToLead(
    leadId: string,
    values: Record<string, string>,
  ): Promise<'attached' | 'duplicate'> {
    const lead = await this.findLeadOrFail(leadId);
    if (!lead.accountId) {
      throw new BadRequestException(
        'El lead no tiene empresa para asociar el contacto',
      );
    }

    const nombre = values.contacto_nombre?.trim();
    const email = values.email?.trim().toLowerCase();
    if (!nombre || !email) {
      throw new BadRequestException('Missing required lead fields');
    }

    const duplicate = await this.findDuplicateByAccountIdAndEmail(
      lead.accountId,
      email,
    );
    if (duplicate) {
      return 'duplicate';
    }

    const tipoInfluencia = this.parseImportInfluencia(values.tipo_influencia);
    const telefono = values.telefono
      ? normalizePhoneToE164(values.telefono)
      : null;
    const { person_id: personId } =
      await this.accountsService.findOrCreatePersonForAccount(lead.accountId, {
        person_name: nombre,
        job_title: values.cargo?.trim() || null,
        email,
        phone: telefono,
      });

    const alreadyLinked = await this.leadContactModel.findOne({
      where: { leadId, personId },
    });
    if (alreadyLinked) {
      return 'duplicate';
    }

    await this.sequelize.transaction(async (transaction) => {
      const maxPosition = Number(
        await this.leadContactModel.max('position', {
          where: { leadId },
          transaction,
        }),
      );
      const position = (Number.isFinite(maxPosition) ? maxPosition : 0) + 1;
      await this.leadContactModel.create(
        {
          leadId,
          position,
          personId,
          tipoInfluencia,
        },
        { transaction },
      );
    });

    return 'attached';
  }

  async findDuplicateByEmailAndNit(
    email: string,
    nit: string | null,
    accountRaw?: string,
  ): Promise<Lead | null> {
    const normalizedEmail = email?.trim().toLowerCase();
    const { name: accountName, taxId } = this.parseImportAccountRef(
      accountRaw?.trim() || '',
      nit,
    );
    if (!normalizedEmail || !accountName) {
      return null;
    }

    try {
      const account = await this.accountsService.findExistingAccountForImport(
        accountName,
        taxId,
      );
      return this.findDuplicateByAccountIdAndEmail(
        account.account_id,
        normalizedEmail,
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        return null;
      }
      throw error;
    }
  }

  private async findDuplicateByAccountIdAndEmail(
    accountId: string,
    email: string,
  ): Promise<Lead | null> {
    const personId = await this.accountsService.findPersonIdByAccountAndEmail(
      accountId,
      email,
    );
    if (!personId) {
      return null;
    }

    const contact = await this.leadContactModel.findOne({
      where: { personId },
    });
    if (!contact) {
      return null;
    }

    return this.leadModel.findByPk(contact.leadId);
  }

  private async resolveUniqueLeadName(
    requested: string | undefined,
    accountName: string | null,
  ): Promise<string> {
    const base = (requested?.trim() || accountName?.trim() || 'Lead').slice(
      0,
      160,
    );
    if (await this.isNameAvailable(base)) {
      return base;
    }

    for (let n = 2; n < 1000; n++) {
      const suffix = ` (${n})`;
      const candidate = `${base.slice(0, 160 - suffix.length)}${suffix}`;
      if (await this.isNameAvailable(candidate)) {
        return candidate;
      }
    }

    throw new ConflictException({
      code: DEMAND_GENERATION_ERROR_CODES.DUPLICATE_LEAD_NAME,
      message: 'Ya existe un lead con ese nombre',
    });
  }

  async isNameAvailable(
    name: string,
    excludeLeadId?: string,
  ): Promise<boolean> {
    const trimmed = name.trim();
    if (!trimmed) {
      return false;
    }

    const existing = await this.leadModel.findOne({
      where: {
        [Op.and]: [
          Sequelize.where(
            Sequelize.fn('LOWER', Sequelize.col('name')),
            trimmed.toLowerCase(),
          ),
          ...(excludeLeadId
            ? [{ leadId: { [Op.ne]: excludeLeadId } }]
            : []),
        ],
      },
      attributes: ['leadId'],
    });

    return !existing;
  }

  private async assertLeadNameAvailable(
    name: string,
    excludeLeadId?: string,
  ): Promise<void> {
    const available = await this.isNameAvailable(name, excludeLeadId);
    if (!available) {
      throw new ConflictException({
        code: DEMAND_GENERATION_ERROR_CODES.DUPLICATE_LEAD_NAME,
        message: 'Ya existe un lead con ese nombre',
      });
    }
  }

  async getLeadDisplayLabel(lead: Lead): Promise<string> {
    if (lead.name?.trim()) {
      return lead.name.trim();
    }

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
    const fromJson = normalizeCitaContactos(lead.citaContactos);
    const citaContactos =
      fromJson.length > 0
        ? fromJson
        : lead.citaContactoNombre
          ? [
              {
                nombre: lead.citaContactoNombre,
                email: lead.citaContactoEmail ?? '',
                telefono: lead.citaContactoTelefono ?? '',
              },
            ]
          : [];

    return {
      lead_id: lead.leadId,
      name: lead.name,
      tipo_lead: lead.tipoLead,
      origen: lead.origen,
      canal_origen: lead.canalOrigen,
      sub_origen: lead.subOrigen,
      campana_id: lead.campanaId,
      segmento: lead.segmento,
      industria: lead.industria,
      city: lead.city,
      region: lead.region,
      pais: lead.pais,
      account_id: lead.accountId ?? primaryEnriched?.account_id ?? null,
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
            tipo_influencia: readContactInfluenciaTipo(contact),
          };
        }) ?? [],
      business_referrer_id: lead.businessReferrerId,
      segment_id: lead.segmentId,
      subsegment_id: lead.subsegmentId,
      referrer_name: lead.referrerName,
      tipo_influencia: lead.tipoInfluencia,
      estado: lead.estado,
      icp_score: lead.icpScore,
      responsable_id: lead.responsableId,
      responsable_nombre: lead.responsable?.fullName ?? null,
      cita_agendada: lead.citaAgendada,
      fecha_cita: lead.fechaCita,
      cita_lugar: lead.citaLugar,
      cita_contacto_nombre: lead.citaContactoNombre,
      cita_contacto_email: lead.citaContactoEmail,
      cita_contacto_telefono: lead.citaContactoTelefono,
      cita_contactos: citaContactos,
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
    contacts: Array<{
      position: number;
      personId: string;
      tipoInfluencia: LeadContactInfluenciaTipo | null;
    }>,
    businessReferrerId: string | null,
    nit: string | null,
    accountId: string,
  ): Promise<LeadResponseDto> {
    const initialState = this.resolveInitialState(dto.canal_origen);

    const leadId = await this.sequelize.transaction(async (transaction) => {
      const lead = await this.leadModel.create(
        {
          name: dto.name!.trim(),
          tipoLead: dto.tipo_lead ?? TipoLead.Inbound,
          origen: dto.origen,
          canalOrigen: dto.canal_origen,
          subOrigen: dto.sub_origen ?? null,
          campanaId: dto.campana_id ?? null,
          segmento: dto.segmento,
          industria: dto.industria ?? null,
          segmentId: dto.segment_id ?? null,
          subsegmentId: dto.subsegment_id ?? null,
          accountId,
          referrerName: resolveReferrerName(dto.canal_origen, dto.referrer_name),
          city: dto.city,
          region: dto.region,
          pais: (dto.pais ?? 'CO').toUpperCase(),
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
    contacts: Array<{
      position: number;
      personId: string;
      tipoInfluencia: LeadContactInfluenciaTipo | null;
    }>,
    businessReferrerId: string | null,
    nit: string | null,
    accountId: string,
  ): Promise<LeadResponseDto> {
    this.assertDirectRouteCanal(dto.canal_origen, [
      CanalOrigen.BTL,
      CanalOrigen.Fabrica,
    ]);
    const checklist = this.assertDirectChecklistComplete(dto.checklist);

    const leadId = await this.sequelize.transaction(async (transaction) => {
      const lead = await this.leadModel.create(
        {
          name: dto.name!.trim(),
          tipoLead: dto.tipo_lead ?? TipoLead.Inbound,
          origen: dto.origen,
          canalOrigen: dto.canal_origen,
          subOrigen: dto.sub_origen ?? null,
          campanaId: dto.campana_id ?? null,
          segmento: dto.segmento,
          industria: dto.industria ?? null,
          segmentId: dto.segment_id ?? null,
          subsegmentId: dto.subsegment_id ?? null,
          accountId,
          referrerName: resolveReferrerName(dto.canal_origen, dto.referrer_name),
          city: dto.city,
          region: dto.region,
          pais: (dto.pais ?? 'CO').toUpperCase(),
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
    contacts: Array<{
      position: number;
      personId: string;
      tipoInfluencia: LeadContactInfluenciaTipo | null;
    }>,
    businessReferrerId: string | null,
    nit: string | null,
    accountId: string,
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
          name: dto.name!.trim(),
          tipoLead: dto.tipo_lead ?? TipoLead.Inbound,
          origen: dto.origen,
          canalOrigen: dto.canal_origen,
          subOrigen: dto.sub_origen ?? null,
          campanaId: dto.campana_id ?? null,
          segmento: dto.segmento,
          industria: dto.industria ?? null,
          segmentId: dto.segment_id ?? null,
          subsegmentId: dto.subsegment_id ?? null,
          accountId,
          referrerName: resolveReferrerName(dto.canal_origen, dto.referrer_name),
          city: dto.city,
          region: dto.region,
          pais: (dto.pais ?? 'CO').toUpperCase(),
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

  private async resolveImportSegmentIds(
    segmento: Segmento,
    subsegmentName: string,
  ): Promise<{ segmentId: string | null; subsegmentId: string | null }> {
    const segment = await this.segmentModel.findOne({
      where: { name: segmento, active: true },
    });
    if (!segment) {
      return { segmentId: null, subsegmentId: null };
    }

    if (!subsegmentName) {
      return { segmentId: segment.id, subsegmentId: null };
    }

    const subsegment = await this.subsegmentModel.findOne({
      where: {
        segmentId: segment.id,
        name: subsegmentName,
        active: true,
      },
    });
    if (!subsegment) {
      throw new BadRequestException(
        `Invalid subsegmento: ${subsegmentName}`,
      );
    }

    return { segmentId: segment.id, subsegmentId: subsegment.id };
  }

  private parseImportInfluencia(
    value?: string,
  ): LeadContactInfluenciaTipo | null {
    const trimmed = value?.trim();
    if (!trimmed) {
      return null;
    }
    if (
      !Object.values(LeadContactInfluenciaTipo).includes(
        trimmed as LeadContactInfluenciaTipo,
      )
    ) {
      throw new BadRequestException(`Invalid tipo_influencia: ${trimmed}`);
    }
    return trimmed as LeadContactInfluenciaTipo;
  }

  private resolveLeadAccountId(
    requestedAccountId: string | undefined,
    contactsAccountId: string,
  ): string {
    if (!requestedAccountId) {
      return contactsAccountId;
    }
    if (requestedAccountId !== contactsAccountId) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
        message:
          'account_id must match the company of the selected contacts',
      });
    }
    return requestedAccountId;
  }

  private async resolveAccountIdForUpdate(
    lead: Lead,
    accountId: string,
  ): Promise<string> {
    await this.accountsService.getAccount(accountId);
    const contactPersonIds =
      lead.contacts?.map((contact) => contact.personId) ?? [];
    if (contactPersonIds.length === 0) {
      return accountId;
    }
    const contactsAccountId =
      await this.accountsService.assertPeopleSameAccount(contactPersonIds);
    if (accountId !== contactsAccountId) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
        message:
          'account_id must match the company of the selected contacts',
      });
    }
    return accountId;
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

  private assertIndustriaRequiresSubsegment(
    segmento: string,
    subsegmentId?: string | null,
  ): void {
    if (isIndustriaSegmento(segmento) && !subsegmentId) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
        message: 'subsegment_id is required when segmento is Industria',
      });
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

  private async resolveImportUserId(
    value: string | undefined,
    fallback?: string,
  ): Promise<string> {
    const raw = value?.trim();
    if (!raw) {
      if (fallback) {
        return fallback;
      }
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
        message: 'User identifier is required',
      });
    }

    if (UUID_PATTERN.test(raw)) {
      await this.ensureUserExists(raw);
      return raw;
    }

    const byEmail = await this.userModel.findOne({
      where: { email: raw.toLowerCase() },
    });
    if (byEmail) {
      return byEmail.userId;
    }

    const byName = await this.userModel.findAll({
      where: { fullName: raw },
    });
    if (byName.length === 1) {
      return byName[0].userId;
    }
    if (byName.length > 1) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
        message: `Multiple users match "${raw}". Use the user email instead.`,
      });
    }

    throw new NotFoundException({
      code: DEMAND_GENERATION_ERROR_CODES.USER_NOT_FOUND,
      message: `User not found: ${raw}`,
    });
  }

  private parseImportAccountRef(
    rawName: string,
    taxIdColumn: string | null,
  ): { name: string; taxId: string | null } {
    const combined = rawName.match(/^(.*) \(([^)]+)\)\s*$/);
    const labelTax = combined?.[2]?.trim() ?? '';
    const looksLikeTaxId = /^\d[\d.\-]{4,}$/.test(labelTax.replace(/\s/g, ''));
    if (combined && looksLikeTaxId) {
      return {
        name: combined[1].trim(),
        taxId: taxIdColumn || labelTax,
      };
    }
    return { name: rawName.trim(), taxId: taxIdColumn };
  }

  private parseImportCityRegion(
    cityRaw: string,
    regionRaw: string,
  ): { city: string; region: string } {
    if (!cityRaw) {
      return { city: '', region: regionRaw };
    }
    const combined = cityRaw.match(/^(.*) \(([^)]+)\)\s*$/);
    if (combined) {
      return {
        city: combined[1].trim(),
        region: combined[2].trim() || regionRaw,
      };
    }
    if (regionRaw) {
      return { city: cityRaw, region: regionRaw };
    }
    throw new BadRequestException(
      'La ciudad debe ir como Municipio (Departamento) para inferir la región.',
    );
  }

  private async resolveImportCampaignId(
    value: string | undefined,
  ): Promise<string | null> {
    const raw = value?.trim();
    if (!raw) {
      return null;
    }
    const campaign =
      await this.campaignsService.findAcceptsLeadsByNameOrId(raw);
    return campaign.campanaId;
  }
}
