import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import {
  Op,
  Sequelize,
  UniqueConstraintError,
  WhereOptions,
} from 'sequelize';
import { User } from '../../auth/models/user.model';
import { UsersService } from '../../auth/services/users.service';
import { DEMAND_GENERATION_ERROR_CODES } from '../constants/demand-generation.constants';
import { CreateLeadDto } from '../dtos/create-lead.dto';
import {
  LeadResponseDto,
  LeadsQueryDto,
  PaginatedLeadsResponseDto,
} from '../dtos/lead-response.dto';
import { RecycleLeadDto } from '../dtos/recycle-lead.dto';
import { RegisterAppointmentDto } from '../dtos/register-appointment.dto';
import { UpdateLeadDto } from '../dtos/update-lead.dto';
import { canRecycleLead } from '../lib/lead-state-machine';
import { normalizePhoneToE164 } from '../lib/phone-normalize';
import {
  CanalOrigen,
  LeadEstado,
  OrigenLead,
  TipoLead,
} from '../models/enums/lead.enums';
import { MqlEstado } from '../models/enums/mql.enums';
import { Segmento } from '../models/enums/segment.enum';
import { Lead } from '../models/lead.model';
import { Mql } from '../models/mql.model';
import {
  NOTIFICATION_PORT,
  NotificationEvent,
} from '../ports/notification.port';
import type { NotificationPort } from '../ports/notification.port';
import { CampaignsService } from './campaigns.service';

@Injectable()
export class LeadsService {
  constructor(
    @InjectModel(Lead) private readonly leadModel: typeof Lead,
    @InjectModel(Mql) private readonly mqlModel: typeof Mql,
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly campaignsService: CampaignsService,
    private readonly usersService: UsersService,
    @Inject(NOTIFICATION_PORT)
    private readonly notifications: NotificationPort,
  ) {}

  async create(
    dto: CreateLeadDto,
    createdBy: string,
  ): Promise<LeadResponseDto> {
    this.assertB2bIndustria(dto.segmento, dto.industria);
    await this.ensureUserExists(dto.responsable_id);

    if (dto.campana_id) {
      await this.campaignsService.assertCampaignAcceptsLeads(dto.campana_id);
    }

    const telefono = dto.telefono ? normalizePhoneToE164(dto.telefono) : null;

    if (dto.telefono && !telefono) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid phone number format',
      });
    }

    try {
      const initialState = this.resolveInitialState(dto.canal_origen);
      const lead = await this.leadModel.create({
        tipoLead: dto.tipo_lead,
        origen: dto.origen,
        canalOrigen: dto.canal_origen,
        subOrigen: dto.sub_origen ?? null,
        campanaId: dto.campana_id ?? null,
        segmento: dto.segmento,
        industria: dto.industria ?? null,
        region: dto.region,
        pais: dto.pais.toUpperCase(),
        empresaNombre: dto.empresa_nombre,
        nit: dto.nit ?? null,
        contactoNombre: dto.contacto_nombre,
        cargo: dto.cargo ?? null,
        email: dto.email.toLowerCase(),
        telefono,
        responsableId: dto.responsable_id,
        utmSource: dto.utm_source ?? null,
        utmMedium: dto.utm_medium ?? null,
        utmCampaign: dto.utm_campaign ?? null,
        estado: initialState,
        createdBy,
      });

      if (lead.campanaId) {
        await this.campaignsService.incrementLeadCount(lead.campanaId);
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

  async findAll(query: LeadsQueryDto): Promise<PaginatedLeadsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const where: WhereOptions<Lead> = {};

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
      ],
      order: [['fechaCaptura', 'DESC']],
      limit,
      offset,
    });

    return {
      items: rows.map((lead) => this.toResponseDto(lead)),
      total: count,
      page,
      limit,
    };
  }

  async findById(leadId: string): Promise<LeadResponseDto> {
    const lead = await this.findLeadOrFail(leadId);
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

    const telefono =
      dto.telefono !== undefined
        ? dto.telefono
          ? normalizePhoneToE164(dto.telefono)
          : null
        : undefined;

    if (dto.telefono && telefono === null) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid phone number format',
      });
    }

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
        ...(dto.empresa_nombre !== undefined
          ? { empresaNombre: dto.empresa_nombre }
          : {}),
        ...(dto.nit !== undefined ? { nit: dto.nit } : {}),
        ...(dto.contacto_nombre !== undefined
          ? { contactoNombre: dto.contacto_nombre }
          : {}),
        ...(dto.cargo !== undefined ? { cargo: dto.cargo } : {}),
        ...(dto.email !== undefined ? { email: dto.email.toLowerCase() } : {}),
        ...(telefono !== undefined ? { telefono } : {}),
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

    return this.toResponseDto(lead);
  }

  async registerAppointment(
    leadId: string,
    dto: RegisterAppointmentDto,
    userId: string,
  ): Promise<LeadResponseDto> {
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
      'EjecutivoComercial',
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
    });

    await this.notifications.notify({
      event: NotificationEvent.AppointmentScheduled,
      recipientUserId: dto.comercial_asignado_id,
      message: `Appointment scheduled for lead ${lead.empresaNombre}`,
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

  /**
   * Create a single imported lead in its channel-specific initial state.
   * Duplicate detection is handled by the caller (import job).
   */
  async importLeadRow(
    values: Record<string, string>,
    createdBy: string,
  ): Promise<Lead> {
    const segmento = values.segmento as Segmento;
    const industria = values.industria || null;
    const canalOrigen = values.canal_origen as CanalOrigen;

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

    if (!values.region || !values.pais || !values.empresa_nombre) {
      throw new BadRequestException('Missing required lead fields');
    }

    await this.ensureUserExists(values.responsable_id);

    const telefono = values.telefono
      ? normalizePhoneToE164(values.telefono)
      : null;

    return this.leadModel.create({
      tipoLead: (values.tipo_lead as TipoLead) || TipoLead.Outbound,
      origen: (values.origen as OrigenLead) || OrigenLead.Email,
      canalOrigen,
      campanaId: values.campana_id || null,
      segmento,
      industria,
      region: values.region,
      pais: values.pais.toUpperCase(),
      empresaNombre: values.empresa_nombre,
      nit: values.nit || null,
      contactoNombre: values.contacto_nombre,
      cargo: values.cargo || null,
      email: values.email.toLowerCase(),
      telefono,
      responsableId: values.responsable_id,
      estado: this.resolveInitialState(canalOrigen),
      createdBy,
    });
  }

  async findDuplicateByEmailAndNit(
    email: string,
    nit: string | null,
  ): Promise<Lead | null> {
    return this.leadModel.findOne({
      where: {
        email: email.toLowerCase(),
        nit: nit ?? null,
      },
    });
  }

  private async findLeadOrFail(leadId: string): Promise<Lead> {
    const lead = await this.leadModel.findByPk(leadId, {
      include: [
        {
          model: User,
          as: 'responsable',
          attributes: ['userId', 'fullName'],
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

  resolveInitialState(canalOrigen: CanalOrigen): LeadEstado {
    if (canalOrigen === CanalOrigen.GeneracionDemandaAgencia) {
      return LeadEstado.MOFU;
    }

    if (canalOrigen === CanalOrigen.TraductorNegocio) {
      throw new ConflictException({
        code: DEMAND_GENERATION_ERROR_CODES.INVALID_TRANSITION,
        message:
          'TRADUCTOR_NEGOCIO flow is pending business definition and cannot be created yet',
      });
    }

    return LeadEstado.TOFU;
  }

  toResponseDto(lead: Lead): LeadResponseDto {
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
      empresa_nombre: lead.empresaNombre,
      nit: lead.nit,
      contacto_nombre: lead.contactoNombre,
      cargo: lead.cargo,
      email: lead.email,
      telefono: lead.telefono,
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
}
