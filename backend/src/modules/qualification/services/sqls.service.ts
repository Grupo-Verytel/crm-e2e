import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Op, Sequelize, type Transaction, type WhereOptions } from 'sequelize';
import { User } from '../../auth/models/user.model';
import { UsersService } from '../../auth/services/users.service';
import type { UserResponseDto } from '../../auth/dtos/user-response.dto';
import { CreateReminderDto } from '../../demand-generation/dtos/create-reminder.dto';
import { ReminderResponseDto } from '../../demand-generation/dtos/reminder-response.dto';
import { CreateInteractionDto } from '../../demand-generation/dtos/create-interaction.dto';
import { InteractionResponseDto } from '../../demand-generation/dtos/interaction-response.dto';
import { DemandGenerationService } from '../../demand-generation/services/demand-generation.service';
import { Lead } from '../../demand-generation/models/lead.model';
import { Mql } from '../../demand-generation/models/mql.model';
import { Sql } from '../../demand-generation/models/sql.model';
import { SqlEstado } from '../../demand-generation/models/enums/sql.enums';
import type { CrearOuvDto } from '../../discovery/dtos/crear-ouv.dto';
import { OuvZona } from '../../discovery/models/enums/ouv.enums';
import { OuvsService } from '../../discovery/services/ouvs.service';
import { GraphService } from '../../graph-integration/services/graph.service';
import { EntityType } from '../../workflow-engine/enums/entity-type.enum';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import {
  QUALIFICATION_ERROR_CODES,
  QUALIFICATION_ROLES,
  isQualificationRole,
} from '../constants/qualification.constants';
import {
  AssignSqlDto,
  CreateAssignedSqlCitaDto,
  CreateSqlCitaDto,
  UpdateSqlCitaDto,
} from '../dtos/assign-sql.dto';
import { CloseSqlCitaDto } from '../dtos/close-sql-cita.dto';
import { SqlAppointmentEventResponseDto } from '../dtos/sql-appointment-event-response.dto';
import {
  AssignSqlResponseDto,
  ConvertirSqlResponseDto,
  PaginatedSqlsResponseDto,
  SqlCitaResponseDto,
  SqlDetailDto,
  SqlsQueryDto,
} from '../dtos/sql-response.dto';
import {
  SqlCitaEstado,
  isOpenCitaEstado,
} from '../models/enums/sql-cita-estado.enum';
import { SqlAppointmentEvent } from '../models/sql-appointment-event.model';
import { SqlCita } from '../models/sql-cita.model';
import {
  isCompleteCitaContacto,
  normalizeCitaContactos,
} from '../lib/cita-contactos';
import { isCitaVigente } from '../lib/cita-vigencia';

@Injectable()
export class SqlsService {
  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    @InjectModel(Sql) private readonly sqlModel: typeof Sql,
    @InjectModel(SqlCita) private readonly sqlCitaModel: typeof SqlCita,
    @InjectModel(SqlAppointmentEvent)
    private readonly sqlAppointmentEventModel: typeof SqlAppointmentEvent,
    private readonly demandGenerationService: DemandGenerationService,
    private readonly usersService: UsersService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly ouvsService: OuvsService,
    private readonly graphService: GraphService,
  ) {}

  /** EARS-02 — Soporte bandeja de enrutamiento. DirectorMercadeo: lectura. */
  async listInbox(
    query: SqlsQueryDto,
    viewerRoleName?: string,
  ): Promise<PaginatedSqlsResponseDto> {
    this.assertCanAccessInbox(viewerRoleName);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const where = { estado: SqlEstado.PendienteAsignacion };

    const [rows, count] = await Promise.all([
      this.sqlModel.findAll({
        where,
        include: [
          {
            model: Mql,
            required: true,
            include: [{ model: Lead, required: true }],
          },
        ],
        order: [['fecha_creacion', 'ASC']],
        limit,
        offset,
      }),
      this.sqlModel.count({ where }),
    ]);

    const items = await this.toListItems(rows);

    return { items, total: count, page, limit };
  }

  /** Assigned SQLs for the current Ejecutivo, or all assigned for DirectorMercadeo. */
  async listAssigned(
    comercialUserId: string,
    query: SqlsQueryDto,
    viewerRoleName?: string,
  ): Promise<PaginatedSqlsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const where: WhereOptions<Sql> = {
      estado: query.estado ?? { [Op.ne]: SqlEstado.PendienteAsignacion },
      ...(this.canViewAllAssignedSqls(viewerRoleName)
        ? {}
        : { comercialAsignadoId: comercialUserId }),
    };

    const [rows, count] = await Promise.all([
      this.sqlModel.findAll({
        where,
        include: [{ model: Mql, required: true }],
        order: [['fechaAsignacion', 'DESC']],
        limit,
        offset,
      }),
      this.sqlModel.count({ where }),
    ]);

    const items = await this.toListItems(rows);

    return { items, total: count, page, limit };
  }

  async findById(
    sqlId: string,
    viewerUserId: string,
    viewerRoleName?: string,
  ): Promise<SqlDetailDto> {
    const sql = await this.findSqlOrFail(sqlId);
    this.assertCanViewSql(sql, viewerUserId, viewerRoleName);
    return this.toDetailResponse(sql);
  }

  /** List every interaction of the lead derived from this SQL. */
  async listInteractions(
    sqlId: string,
    viewerUserId: string,
    viewerRoleName?: string,
  ): Promise<InteractionResponseDto[]> {
    const sql = await this.findSqlOrFail(sqlId);
    this.assertCanViewSql(sql, viewerUserId, viewerRoleName);
    return this.demandGenerationService.listInteractions(
      sql.mql.leadId,
      viewerUserId,
    );
  }

  async createInteractionReminder(
    sqlId: string,
    interactionId: string,
    dto: CreateReminderDto,
    actorUserId: string,
    actorRoleName?: string,
  ): Promise<ReminderResponseDto> {
    const sql = await this.findSqlOrFail(sqlId);
    this.assertCanViewSql(sql, actorUserId, actorRoleName);
    return this.demandGenerationService.createInteractionReminder(
      sql.mql.leadId,
      interactionId,
      actorUserId,
      dto,
    );
  }

  /**
   * Register an interaction on an active SQL. Persists sql_id and the
   * derived lead_id. Does not change lead or MQL state.
   */
  async registerInteraction(
    sqlId: string,
    dto: CreateInteractionDto,
    actorUserId: string,
    actorRoleName?: string,
  ): Promise<InteractionResponseDto> {
    const sql = await this.findSqlOrFail(sqlId);
    this.assertCanRegisterInteraction(sql, actorUserId, actorRoleName);
    return this.demandGenerationService.registerSqlInteraction(
      sql.mql.leadId,
      sql.sqlId,
      dto,
      actorUserId,
    );
  }

  /**
   * EARS-03/04/05/06/09 — assign exclusive comercial + optional cita.
   */
  async assign(
    sqlId: string,
    dto: AssignSqlDto,
    soporteUserId: string,
    soporteRoleName?: string,
  ): Promise<AssignSqlResponseDto> {
    this.assertSoporteOrAdmin(soporteRoleName);

    return this.sequelize.transaction(async (transaction) => {
      const sql = await this.sqlModel.findByPk(sqlId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
        include: [{ model: Mql, required: true }],
      });

      if (!sql) {
        throw new NotFoundException({
          code: QUALIFICATION_ERROR_CODES.NOT_FOUND,
          message: `SQL ${sqlId} not found`,
        });
      }

      if (sql.estado !== SqlEstado.PendienteAsignacion) {
        throw new BadRequestException({
          code: QUALIFICATION_ERROR_CODES.SQL_NOT_PENDING,
          message: `SQL must be in PendienteAsignacion to assign (current: ${sql.estado})`,
        });
      }

      const comercial = await this.requireActiveEjecutivo(
        dto.comercial_asignado_id,
      );

      const estadoAnterior = sql.estado;
      const assignedAt = new Date();
      await sql.update(
        {
          estado: SqlEstado.Asignado,
          comercialAsignadoId: dto.comercial_asignado_id,
          fechaAsignacion: assignedAt,
          enBacklog: false,
        },
        { transaction },
      );

      let cita: SqlCita | null = null;
      if (dto.cita) {
        cita = await this.createCita(
          sql.sqlId,
          dto.cita,
          soporteUserId,
          transaction,
        );
      }

      const lead = await this.demandGenerationService.findLeadById(sql.mql.leadId);
      const interactions =
        await this.demandGenerationService.listInteractions(sql.mql.leadId);

      if (cita && dto.cita) {
        const meeting = await this.createTeamsMeetingForCita({
          comercial,
          leadLabel: this.citaLeadLabel(lead, sql.sqlId),
          dto: dto.cita,
          contactos: this.resolveCitaContactos(dto.cita),
        });
        await cita.update(
          {
            graphEventId: meeting.eventId,
            graphOrganizerUpn: meeting.organizerUpn,
            teamsJoinUrl: meeting.joinUrl,
            durationMinutes: dto.cita.duration_minutes ?? 60,
          },
          { transaction },
        );
        await this.recordAppointmentEvent(
          sql.sqlId,
          SqlCitaEstado.Agendada,
          soporteUserId,
          {
            fecha: String(cita.fecha).slice(0, 10),
            hora: String(cita.hora).slice(0, 8),
          },
          transaction,
        );
      }

      const citaDto = cita ? this.toCitaResponse(cita) : null;

      await this.workflowEngine.transition(
        EntityType.SQL,
        sql.sqlId,
        'sql.asignado',
        {
          estadoAnterior,
          estadoNuevo: SqlEstado.Asignado,
          entityLabel: String(
            (lead as { empresa_nombre?: string }).empresa_nombre ??
              sql.sqlId,
          ),
          actorUserId: soporteUserId,
          payload: {
            comercial_asignado_id: dto.comercial_asignado_id,
            sqlId: sql.sqlId,
            leadId: sql.mql.leadId,
            mqlId: sql.mqlId,
            assignedBy: soporteUserId,
            lead,
            interactions,
            ...(citaDto ? { cita: citaDto } : {}),
          },
          entity: { estado: estadoAnterior },
        },
        transaction,
      );

      const detail = await this.toDetailResponse(
        sql,
        lead as unknown as Record<string, unknown>,
        cita,
      );
      return { sql: detail, cita: citaDto };
    });
  }

  /** EARS-07 — Ejecutivo reagenda cita of own SQL. */
  async updateCita(
    sqlId: string,
    dto: UpdateSqlCitaDto,
    actorUserId: string,
    actorRoleName?: string,
  ): Promise<SqlCitaResponseDto> {
    return this.sequelize.transaction(async (transaction) => {
      const sql = await this.findSqlOrFail(sqlId);
      this.assertCanScheduleAssignedCita(sql, actorUserId, actorRoleName);

      if (
        sql.estado === SqlEstado.PendienteAsignacion ||
        !sql.comercialAsignadoId
      ) {
        throw new BadRequestException({
          code: QUALIFICATION_ERROR_CODES.SQL_NOT_ASSIGNED,
          message: 'SQL must be assigned before rescheduling a cita',
        });
      }

      const cita = await this.sqlCitaModel.findOne({
        where: { sqlId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!cita) {
        throw new NotFoundException({
          code: QUALIFICATION_ERROR_CODES.CITA_NOT_FOUND,
          message: `No cita found for SQL ${sqlId}`,
        });
      }
      this.assertCitaIsOpen(cita);

      const previousFecha = String(cita.fecha).slice(0, 10);
      const previousHora = String(cita.hora).slice(0, 8);

      await cita.update(
        {
          estado: SqlCitaEstado.Reagendada,
          ...(dto.lugar !== undefined ? { lugar: dto.lugar } : {}),
          ...(dto.fecha !== undefined ? { fecha: dto.fecha } : {}),
          ...(dto.hora !== undefined ? { hora: this.normalizeHora(dto.hora) } : {}),
          ...(dto.contacto_nombre !== undefined
            ? { contactoNombre: dto.contacto_nombre }
            : {}),
          ...(dto.contacto_cargo !== undefined
            ? { contactoCargo: dto.contacto_cargo }
            : {}),
          ...(dto.descripcion !== undefined
            ? { descripcion: dto.descripcion }
            : {}),
          ...(dto.duration_minutes !== undefined
            ? { durationMinutes: dto.duration_minutes }
            : {}),
        },
        { transaction },
      );

      const lead = await this.demandGenerationService.findLeadById(
        sql.mql.leadId,
      );

      if (cita.graphEventId && cita.graphOrganizerUpn) {
        await this.updateTeamsMeetingForCita(
          cita,
          this.citaLeadLabel(lead, sql.sqlId),
        );
      }

      await this.recordAppointmentEvent(
        sql.sqlId,
        SqlCitaEstado.Reagendada,
        actorUserId,
        {
          fecha: String(cita.fecha).slice(0, 10),
          hora: String(cita.hora).slice(0, 8),
          fecha_anterior: previousFecha,
          hora_anterior: previousHora,
        },
        transaction,
      );

      if (
        isQualificationRole(
          actorRoleName,
          QUALIFICATION_ROLES.EJECUTIVO_COMERCIAL,
        )
      ) {
        await this.workflowEngine.transition(
          EntityType.SQL,
          sql.sqlId,
          'sql.cita_reagendada',
          {
            estadoAnterior: sql.estado,
            estadoNuevo: sql.estado,
            entityLabel: String(
              (lead as { empresa_nombre?: string }).empresa_nombre ?? sql.sqlId,
            ),
            actorUserId,
            payload: {
              sqlId: sql.sqlId,
              cita: this.toCitaResponse(cita),
            },
            entity: { estado: sql.estado },
          },
          transaction,
        );
      }

      return this.toCitaResponse(cita);
    });
  }

  /**
   * Removes the programmed cita so the row can be scheduled again.
   * Also cancels the Teams event so it leaves the organizer calendar.
   */
  async cancelCitaForAssignedSql(
    sqlId: string,
    actorUserId: string,
    actorRoleName?: string,
  ): Promise<void> {
    await this.sequelize.transaction(async (transaction) => {
      const sql = await this.sqlModel.findByPk(sqlId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
        include: [{ model: Mql, required: true }],
      });
      if (!sql) {
        throw new NotFoundException({
          code: QUALIFICATION_ERROR_CODES.NOT_FOUND,
          message: `SQL ${sqlId} not found`,
        });
      }
      if (sql.estado !== SqlEstado.Asignado) {
        throw new BadRequestException({
          code: QUALIFICATION_ERROR_CODES.SQL_NOT_ASSIGNED,
          message: 'SQL must be Asignado to cancel the cita',
        });
      }
      this.assertCanScheduleAssignedCita(sql, actorUserId, actorRoleName);

      const cita = await this.sqlCitaModel.findOne({
        where: { sqlId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!cita) {
        throw new NotFoundException({
          code: QUALIFICATION_ERROR_CODES.CITA_NOT_FOUND,
          message: `No cita found for SQL ${sqlId}`,
        });
      }
      this.assertCitaIsOpen(cita);

      if (cita.graphEventId) {
        try {
          await this.graphService.cancelMeeting(
            cita.graphEventId,
            cita.graphOrganizerUpn ?? undefined,
            'Cita cancelada desde el CRM.',
          );
        } catch (error) {
          throw new BadRequestException({
            code: QUALIFICATION_ERROR_CODES.TEAMS_MEETING_FAILED,
            message:
              error instanceof Error
                ? error.message
                : 'No se pudo quitar la reunión del calendario. La cita no se eliminó.',
          });
        }
      }

      await this.recordAppointmentEvent(
        sql.sqlId,
        SqlCitaEstado.Cancelada,
        actorUserId,
        {
          fecha: String(cita.fecha).slice(0, 10),
          hora: String(cita.hora).slice(0, 8),
        },
        transaction,
      );
      await cita.destroy({ transaction });
    });
  }

  async listAppointmentEvents(
    sqlId: string,
    viewerUserId: string,
    viewerRoleName?: string,
  ): Promise<SqlAppointmentEventResponseDto[]> {
    const sql = await this.findSqlOrFail(sqlId);
    this.assertCanViewSql(sql, viewerUserId, viewerRoleName);
    const events = await this.sqlAppointmentEventModel.findAll({
      where: { sqlId },
      include: [{ model: User, as: 'actor', required: false }],
      order: [
        ['occurredAt', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    });
    return events.map((event) => this.toAppointmentEventResponse(event));
  }

  async closeCita(
    sqlId: string,
    dto: CloseSqlCitaDto,
    actorUserId: string,
    actorRoleName?: string,
  ): Promise<SqlCitaResponseDto> {
    return this.sequelize.transaction(async (transaction) => {
      const sql = await this.sqlModel.findByPk(sqlId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
        include: [{ model: Mql, required: true }],
      });
      if (!sql) {
        throw new NotFoundException({
          code: QUALIFICATION_ERROR_CODES.NOT_FOUND,
          message: `SQL ${sqlId} not found`,
        });
      }
      if (sql.estado !== SqlEstado.Asignado) {
        throw new BadRequestException({
          code: QUALIFICATION_ERROR_CODES.SQL_NOT_ASSIGNED,
          message: 'SQL must be Asignado to close the cita',
        });
      }
      this.assertCanScheduleAssignedCita(sql, actorUserId, actorRoleName);

      const cita = await this.sqlCitaModel.findOne({
        where: { sqlId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!cita) {
        throw new NotFoundException({
          code: QUALIFICATION_ERROR_CODES.CITA_NOT_FOUND,
          message: `No cita found for SQL ${sqlId}`,
        });
      }
      this.assertCitaIsOpen(cita);

      await cita.update({ estado: dto.resultado }, { transaction });
      await this.recordAppointmentEvent(
        sql.sqlId,
        dto.resultado,
        actorUserId,
        {
          fecha: String(cita.fecha).slice(0, 10),
          hora: String(cita.hora).slice(0, 8),
        },
        transaction,
      );
      return this.toCitaResponse(cita);
    });
  }

  /**
   * Schedule a cita on an SQL already in Asignado.
   * Does not change comercial_asignado_id, estado, or fecha_asignacion.
   * A past cita keeps its old Teams event and stores a new graph_event_id.
   */
  async createCitaForAssignedSql(
    sqlId: string,
    dto: CreateAssignedSqlCitaDto,
    actorUserId: string,
    actorRoleName?: string,
  ): Promise<SqlCitaResponseDto> {
    return this.sequelize.transaction(async (transaction) => {
      const sql = await this.sqlModel.findByPk(sqlId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
        include: [{ model: Mql, required: true }],
      });

      if (!sql) {
        throw new NotFoundException({
          code: QUALIFICATION_ERROR_CODES.NOT_FOUND,
          message: `SQL ${sqlId} not found`,
        });
      }

      if (sql.estado !== SqlEstado.Asignado || !sql.comercialAsignadoId) {
        throw new BadRequestException({
          code: QUALIFICATION_ERROR_CODES.SQL_NOT_ASSIGNED,
          message: `SQL must be in Asignado to schedule a cita (current: ${sql.estado})`,
        });
      }

      this.assertCanScheduleAssignedCita(
        sql,
        actorUserId,
        actorRoleName,
      );

      const existing = await this.sqlCitaModel.findOne({
        where: { sqlId: sql.sqlId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (
        existing &&
        isOpenCitaEstado(existing.estado) &&
        isCitaVigente(existing.fecha, existing.hora)
      ) {
        throw new BadRequestException({
          code: QUALIFICATION_ERROR_CODES.CITA_VIGENTE_EXISTS,
          message: `SQL ${sqlId} already has a vigente cita`,
        });
      }

      const comercial = await this.requireActiveEjecutivo(
        sql.comercialAsignadoId,
      );
      const contactos = this.resolveCitaContactos(dto);
      const lead = await this.demandGenerationService.findLeadById(
        sql.mql.leadId,
      );
      const meeting = await this.createTeamsMeetingForCita({
        comercial,
        leadLabel: this.citaLeadLabel(lead, sql.sqlId),
        dto,
        contactos,
      });

      const graphFields = {
        graphEventId: meeting.eventId,
        graphOrganizerUpn: meeting.organizerUpn,
        teamsJoinUrl: meeting.joinUrl,
        durationMinutes: dto.duration_minutes ?? 60,
      };

      if (!existing) {
        const created = await this.createCita(
          sql.sqlId,
          dto,
          actorUserId,
          transaction,
        );
        await created.update(graphFields, { transaction });
        await this.recordAppointmentEvent(
          sql.sqlId,
          SqlCitaEstado.Agendada,
          actorUserId,
          {
            fecha: dto.fecha.slice(0, 10),
            hora: this.normalizeHora(dto.hora),
          },
          transaction,
        );
        return this.toCitaResponse(created);
      }

      const principal = contactos[0];
      // afterUpdate on sql_citas records valor_anterior/valor_nuevo per column
      // (fecha, hora, teams_join_url, graph_event_id) with the request user.
      // The previous Teams event is not patched.
      await existing.update(
        {
          lugar: dto.lugar,
          fecha: dto.fecha.slice(0, 10),
          hora: this.normalizeHora(dto.hora),
          contactoNombre: principal.nombre,
          contactoEmail: principal.email || null,
          contactoTelefono: principal.telefono || null,
          contactos,
          contactoCargo: dto.contacto_cargo ?? null,
          descripcion: dto.descripcion ?? null,
          agendadaPor: actorUserId,
          estado: SqlCitaEstado.Agendada,
          ...graphFields,
        },
        { transaction },
      );
      await this.recordAppointmentEvent(
        sql.sqlId,
        SqlCitaEstado.Agendada,
        actorUserId,
        {
          fecha: dto.fecha.slice(0, 10),
          hora: this.normalizeHora(dto.hora),
        },
        transaction,
      );
      return this.toCitaResponse(existing);
    });
  }

  /**
   * EARS-10..13 — Ejecutivo Comercial converts own Asignado SQL into an OUV.
   */
  async convertirEnOuv(
    sqlId: string,
    dto: CrearOuvDto,
    comercialUserId: string,
  ): Promise<ConvertirSqlResponseDto> {
    return this.sequelize.transaction(async (transaction) => {
      const sql = await this.sqlModel.findByPk(sqlId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
        include: [{ model: Mql, required: true }],
      });

      if (!sql) {
        throw new NotFoundException({
          code: QUALIFICATION_ERROR_CODES.NOT_FOUND,
          message: `SQL ${sqlId} not found`,
        });
      }

      if (sql.estado !== SqlEstado.Asignado) {
        throw new BadRequestException({
          code: QUALIFICATION_ERROR_CODES.SQL_NOT_ASSIGNED,
          message: `SQL must be in Asignado to convert (current: ${sql.estado})`,
        });
      }

      if (sql.comercialAsignadoId !== comercialUserId) {
        throw new ForbiddenException({
          code: QUALIFICATION_ERROR_CODES.FORBIDDEN,
          message: 'Only the assigned Ejecutivo Comercial can convert this SQL',
        });
      }

      if (sql.ouvId) {
        throw new BadRequestException({
          code: QUALIFICATION_ERROR_CODES.VALIDATION_ERROR,
          message: `SQL ${sqlId} is already linked to an OUV`,
        });
      }

      const estadoAnterior = sql.estado;
      const lead = await this.demandGenerationService.findLeadById(sql.mql.leadId);

      const ouv = await this.ouvsService.crearDesdeSql(
        {
          sqlId: sql.sqlId,
          comercialId: comercialUserId,
          leadId: sql.mql.leadId,
          dto,
        },
        transaction,
      );

      // Emit while SQL is still Asignado in DB (guard EARS-13); then mark converted.
      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        'ouv.creada_desde_sql',
        {
          estadoAnterior,
          estadoNuevo: OuvZona.Universo,
          entityLabel: ouv.consecutivo,
          actorUserId: comercialUserId,
          payload: {
            sqlId: sql.sqlId,
            leadId: sql.mql.leadId,
            comercial_asignado_id: sql.comercialAsignadoId,
            ouv_id: ouv.ouvId,
            consecutivo: ouv.consecutivo,
          },
          entity: { estado: estadoAnterior },
        },
        transaction,
      );

      await sql.update(
        {
          estado: SqlEstado.ConvertidoOUV,
          ouvId: ouv.ouvId,
          enBacklog: false,
        },
        { transaction },
      );

      const detail = await this.toDetailResponse(
        sql,
        lead as unknown as Record<string, unknown>,
      );
      return {
        sql: {
          ...detail,
          ouv_id: ouv.ouvId,
          ouv: { ouv_id: ouv.ouvId, consecutivo: ouv.consecutivo },
        },
        ouv: {
          ouv_id: ouv.ouvId,
          consecutivo: ouv.consecutivo,
          titulo: ouv.titulo,
          segmento: ouv.segmento,
          vertical: ouv.vertical,
          zona_actual: ouv.zonaActual,
          resultado: ouv.resultado,
        },
      };
    });
  }

  private async createCita(
    sqlId: string,
    dto: CreateSqlCitaDto,
    agendadaPor: string,
    transaction: import('sequelize').Transaction,
  ): Promise<SqlCita> {
    const existing = await this.sqlCitaModel.findOne({
      where: { sqlId },
      transaction,
    });
    if (existing) {
      throw new BadRequestException({
        code: QUALIFICATION_ERROR_CODES.CITA_ALREADY_EXISTS,
        message: `SQL ${sqlId} already has a cita`,
      });
    }

    const contactos = this.resolveCitaContactos(dto);
    const principal = contactos[0];
    if (!principal) {
      throw new BadRequestException({
        code: QUALIFICATION_ERROR_CODES.VALIDATION_ERROR,
        message:
          'At least one complete cita contact (nombre, email, telefono) is required',
      });
    }

    return this.sqlCitaModel.create(
      {
        sqlId,
        lugar: dto.lugar,
        fecha: dto.fecha,
        hora: this.normalizeHora(dto.hora),
        contactoNombre: principal.nombre,
        contactoEmail: principal.email || null,
        contactoTelefono: principal.telefono || null,
        contactos,
        contactoCargo: dto.contacto_cargo ?? null,
        descripcion: dto.descripcion ?? null,
        durationMinutes: dto.duration_minutes ?? 60,
        agendadaPor,
        estado: SqlCitaEstado.Agendada,
      },
      { transaction },
    );
  }

  private resolveCitaContactos(dto: CreateSqlCitaDto): Array<{
    nombre: string;
    email: string;
    telefono: string;
  }> {
    const contactos = normalizeCitaContactos(
      dto.contactos ??
        [
          {
            nombre: dto.contacto_nombre,
            email: dto.contacto_email ?? '',
            telefono: dto.contacto_telefono ?? '',
          },
        ],
    );
    if (!contactos.length || !contactos.every(isCompleteCitaContacto)) {
      throw new BadRequestException({
        code: QUALIFICATION_ERROR_CODES.VALIDATION_ERROR,
        message:
          'At least one complete cita contact (nombre, email, telefono) is required',
      });
    }
    return contactos;
  }

  private async requireActiveEjecutivo(
    userId: string,
  ): Promise<UserResponseDto> {
    const commercials = await this.usersService.findActiveByRoleName(
      QUALIFICATION_ROLES.EJECUTIVO_COMERCIAL,
    );
    const match = commercials.find((u) => u.user_id === userId);
    if (!match) {
      throw new BadRequestException({
        code: QUALIFICATION_ERROR_CODES.USER_NOT_FOUND,
        message:
          'comercial_asignado_id must reference an active EjecutivoComercial',
      });
    }
    return match;
  }

  private async createTeamsMeetingForCita(params: {
    comercial: UserResponseDto;
    leadLabel: string;
    dto: CreateSqlCitaDto;
    contactos: Array<{ nombre: string; email: string; telefono: string }>;
  }): Promise<{
    eventId: string;
    organizerUpn: string;
    joinUrl: string | null;
  }> {
    const organizerUpn = this.assertOrgMailbox(params.comercial.email);
    const { startTime, endTime } = this.citaWindow(
      params.dto.fecha,
      params.dto.hora,
      params.dto.duration_minutes ?? 60,
    );
    const attendees = params.contactos
      .filter((contacto) => contacto.email.includes('@'))
      .map((contacto) => ({
        email: contacto.email,
        name: contacto.nombre,
        type: 'required' as const,
      }));

    try {
      const meeting = await this.graphService.createMeeting({
        organizerUpn,
        subject: `Cita SQL — ${params.leadLabel}`,
        startTime,
        endTime,
        timeZone: this.graphService.timeZone,
        attendees,
        location: params.dto.lugar,
        body: params.dto.descripcion ?? undefined,
        isOnlineMeeting: true,
      });
      return {
        eventId: meeting.eventId,
        organizerUpn: meeting.organizer.email ?? organizerUpn,
        joinUrl: meeting.joinUrl,
      };
    } catch (error) {
      throw new BadRequestException({
        code: QUALIFICATION_ERROR_CODES.TEAMS_MEETING_FAILED,
        message:
          error instanceof Error
            ? error.message
            : 'No se pudo crear la reunión de Teams. Verifica la integración y el correo del comercial.',
      });
    }
  }

  private citaLeadLabel(
    lead: { name?: string | null; empresa_nombre?: string | null },
    fallbackSqlId: string,
  ): string {
    const name = lead.name?.trim();
    if (name) return name;
    const empresa = lead.empresa_nombre?.trim();
    if (empresa) return empresa;
    return fallbackSqlId;
  }

  private async updateTeamsMeetingForCita(
    cita: SqlCita,
    leadLabel: string,
  ): Promise<void> {
    if (!cita.graphEventId || !cita.graphOrganizerUpn) {
      return;
    }
    const { startTime, endTime } = this.citaWindow(
      String(cita.fecha),
      String(cita.hora),
      cita.durationMinutes ?? 60,
    );
    const contactos = normalizeCitaContactos(cita.contactos);
    try {
      await this.graphService.updateMeeting(cita.graphEventId, {
        organizerUpn: cita.graphOrganizerUpn,
        subject: `Cita SQL — ${leadLabel}`,
        startTime,
        endTime,
        timeZone: this.graphService.timeZone,
        attendees: contactos
          .filter((contacto) => contacto.email.includes('@'))
          .map((contacto) => ({
            email: contacto.email,
            name: contacto.nombre,
            type: 'required' as const,
          })),
        location: cita.lugar,
        body: cita.descripcion ?? undefined,
        isOnlineMeeting: true,
      });
    } catch (error) {
      throw new BadRequestException({
        code: QUALIFICATION_ERROR_CODES.TEAMS_MEETING_FAILED,
        message:
          error instanceof Error
            ? error.message
            : 'No se pudo actualizar la reunión de Teams.',
      });
    }
  }

  private assertOrgMailbox(email: string): string {
    const trimmed = email.trim().toLowerCase();
    const domain = trimmed.split('@')[1];
    if (!domain || !this.graphService.domains.includes(domain)) {
      throw new BadRequestException({
        code: QUALIFICATION_ERROR_CODES.TEAMS_MEETING_FAILED,
        message:
          'El comercial debe tener un correo de frisson.net.co o grupoverytel.com para crear la reunión de Teams.',
      });
    }
    return trimmed;
  }

  private citaWindow(
    fecha: string,
    hora: string,
    durationMinutes: number,
  ): { startTime: string; endTime: string } {
    const datePart = fecha.slice(0, 10);
    const time = this.normalizeHora(hora);
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
    const timeMatch = /^(\d{2}):(\d{2})/.exec(time);
    if (!dateMatch || !timeMatch) {
      throw new BadRequestException({
        code: QUALIFICATION_ERROR_CODES.VALIDATION_ERROR,
        message: 'fecha and hora must form a valid datetime',
      });
    }
    const startMinutes =
      Number(timeMatch[1]) * 60 + Number(timeMatch[2]);
    const endMinutes = startMinutes + durationMinutes;
    const pad = (value: number) => String(value).padStart(2, '0');
    const toClock = (total: number) => {
      const hours = Math.floor(total / 60);
      const minutes = total % 60;
      return `${pad(hours)}:${pad(minutes)}`;
    };
    return {
      startTime: `${datePart}T${toClock(startMinutes)}`,
      endTime: `${datePart}T${toClock(endMinutes)}`,
    };
  }

  private assertCitaIsOpen(cita: SqlCita): void {
    if (isOpenCitaEstado(cita.estado)) {
      return;
    }
    throw new BadRequestException({
      code: QUALIFICATION_ERROR_CODES.CITA_ALREADY_CLOSED,
      message: 'La cita ya tiene un resultado final',
    });
  }

  private async recordAppointmentEvent(
    sqlId: string,
    eventType: SqlCitaEstado,
    actorUserId: string,
    payload: {
      fecha?: string;
      hora?: string;
      fecha_anterior?: string;
      hora_anterior?: string;
    },
    transaction: Transaction,
  ): Promise<void> {
    await this.sqlAppointmentEventModel.create(
      {
        sqlId,
        eventType,
        actorUserId,
        occurredAt: new Date(),
        payload,
      },
      { transaction },
    );
  }

  private toAppointmentEventResponse(
    event: SqlAppointmentEvent,
  ): SqlAppointmentEventResponseDto {
    return {
      sql_appointment_event_id: event.sqlAppointmentEventId,
      sql_id: event.sqlId,
      event_type: event.eventType,
      occurred_at: event.occurredAt,
      actor_user_id: event.actorUserId,
      actor_name: event.actor?.fullName ?? null,
      payload: event.payload ?? null,
      notes: event.notes,
    };
  }

  private assertCanScheduleAssignedCita(
    sql: Sql,
    actorUserId: string,
    actorRoleName?: string,
  ): void {
    if (isQualificationRole(actorRoleName, QUALIFICATION_ROLES.SOPORTE_COMERCIAL)) {
      return;
    }
    if (
      isQualificationRole(actorRoleName, QUALIFICATION_ROLES.EJECUTIVO_COMERCIAL) &&
      sql.comercialAsignadoId === actorUserId
    ) {
      return;
    }
    throw new ForbiddenException({
      code: QUALIFICATION_ERROR_CODES.FORBIDDEN,
      message:
        'Only SoporteComercial or the assigned Ejecutivo Comercial can schedule the cita',
    });
  }

  private assertSoporteOrAdmin(roleName?: string): void {
    if (
      isQualificationRole(
        roleName,
        QUALIFICATION_ROLES.SOPORTE_COMERCIAL,
        'Admin',
      )
    ) {
      return;
    }
    throw new ForbiddenException({
      code: QUALIFICATION_ERROR_CODES.FORBIDDEN,
      message: 'Only SoporteComercial can assign SQLs',
    });
  }

  private assertCanAccessInbox(roleName?: string): void {
    if (
      isQualificationRole(
        roleName,
        QUALIFICATION_ROLES.SOPORTE_COMERCIAL,
        QUALIFICATION_ROLES.DIRECTOR_MERCADEO,
        'Admin',
      )
    ) {
      return;
    }
    throw new ForbiddenException({
      code: QUALIFICATION_ERROR_CODES.FORBIDDEN,
      message: 'Not allowed to access the routing inbox',
    });
  }

  private canViewAllAssignedSqls(roleName?: string): boolean {
    return isQualificationRole(
      roleName,
      QUALIFICATION_ROLES.DIRECTOR_MERCADEO,
      QUALIFICATION_ROLES.SOPORTE_COMERCIAL,
      'Admin',
      'GestorMercadeo',
    );
  }

  private async toListItems(rows: Sql[]): Promise<SqlDetailDto[]> {
    const counts = await this.demandGenerationService.countInteractionsByLeadIds(
      rows.map((sql) => sql.mql.leadId),
    );
    const items = await Promise.all(
      rows.map((sql) => this.toDetailResponse(sql)),
    );
    return items.map((item, index) => ({
      ...item,
      interactions_count: counts[rows[index].mql.leadId] ?? 0,
    }));
  }

  private assertCanRegisterInteraction(
    sql: Sql,
    actorUserId: string,
    actorRoleName?: string,
  ): void {
    if (
      sql.estado !== SqlEstado.PendienteAsignacion &&
      sql.estado !== SqlEstado.Asignado
    ) {
      throw new BadRequestException({
        code: QUALIFICATION_ERROR_CODES.SQL_INTERACTION_READ_ONLY,
        message: `Cannot register an interaction while SQL is ${sql.estado}`,
      });
    }

    if (
      isQualificationRole(
        actorRoleName,
        QUALIFICATION_ROLES.SOPORTE_COMERCIAL,
        'Admin',
      )
    ) {
      return;
    }

    if (
      isQualificationRole(actorRoleName, QUALIFICATION_ROLES.EJECUTIVO_COMERCIAL) &&
      sql.comercialAsignadoId === actorUserId
    ) {
      return;
    }

    throw new ForbiddenException({
      code: QUALIFICATION_ERROR_CODES.FORBIDDEN,
      message: 'Not allowed to register an interaction on this SQL',
    });
  }

  private assertCanViewSql(
    sql: Sql,
    viewerUserId: string,
    viewerRoleName?: string,
  ): void {
    if (
      isQualificationRole(
        viewerRoleName,
        QUALIFICATION_ROLES.SOPORTE_COMERCIAL,
        QUALIFICATION_ROLES.DIRECTOR_MERCADEO,
        'Admin',
        'GestorMercadeo',
      )
    ) {
      return;
    }
    if (
      sql.estado !== SqlEstado.PendienteAsignacion &&
      sql.comercialAsignadoId === viewerUserId
    ) {
      return;
    }
    throw new ForbiddenException({
      code: QUALIFICATION_ERROR_CODES.FORBIDDEN,
      message: 'Not allowed to view this SQL',
    });
  }

  private async findSqlOrFail(sqlId: string): Promise<Sql> {
    const sql = await this.sqlModel.findByPk(sqlId, {
      include: [{ model: Mql, required: true }],
    });
    if (!sql) {
      throw new NotFoundException({
        code: QUALIFICATION_ERROR_CODES.NOT_FOUND,
        message: `SQL ${sqlId} not found`,
      });
    }
    return sql;
  }

  private normalizeHora(hora: string): string {
    return hora.length === 5 ? `${hora}:00` : hora;
  }

  private toCitaResponse(cita: SqlCita): SqlCitaResponseDto {
    const contactos = normalizeCitaContactos(
      cita.contactos ?? [
        {
          nombre: cita.contactoNombre,
          email: cita.contactoEmail ?? '',
          telefono: cita.contactoTelefono ?? '',
        },
      ],
    );
    return {
      cita_id: cita.citaId,
      sql_id: cita.sqlId,
      lugar: cita.lugar,
      fecha: cita.fecha,
      hora: String(cita.hora).slice(0, 8),
      contacto_nombre: cita.contactoNombre,
      contacto_email: cita.contactoEmail,
      contacto_telefono: cita.contactoTelefono,
      contactos,
      contacto_cargo: cita.contactoCargo,
      descripcion: cita.descripcion,
      agendada_por: cita.agendadaPor,
      estado: cita.estado ?? SqlCitaEstado.Agendada,
      graph_event_id: cita.graphEventId,
      graph_organizer_upn: cita.graphOrganizerUpn,
      teams_join_url: cita.teamsJoinUrl,
      duration_minutes: cita.durationMinutes ?? 60,
      vigente:
        isOpenCitaEstado(cita.estado) && isCitaVigente(cita.fecha, cita.hora),
      created_at: cita.createdAt,
      updated_at: cita.updatedAt,
    };
  }

  private async toDetailResponse(
    sql: Sql,
    leadDto?: Record<string, unknown>,
    citaModel?: SqlCita | null,
  ): Promise<SqlDetailDto> {
    const mql = sql.mql;
    if (!mql?.leadId) {
      throw new NotFoundException({
        code: QUALIFICATION_ERROR_CODES.NOT_FOUND,
        message: `SQL ${sql.sqlId} is missing MQL linkage`,
      });
    }

    const lead =
      leadDto ??
      ((await this.demandGenerationService.findLeadById(
        mql.leadId,
      )) as unknown as Record<string, unknown>);
    let cita = citaModel ?? null;
    if (cita === null) {
      cita = await this.sqlCitaModel.findOne({ where: { sqlId: sql.sqlId } });
    }

    let ouvSummary: SqlDetailDto['ouv'] = null;
    if (sql.ouvId) {
      const ouv = await this.ouvsService.findById(sql.ouvId);
      if (ouv) {
        ouvSummary = { ouv_id: ouv.ouvId, consecutivo: ouv.consecutivo };
      }
    }

    return {
      sql_id: sql.sqlId,
      mql_id: sql.mqlId,
      estado: sql.estado,
      en_backlog: sql.enBacklog,
      origen_creacion: sql.origenCreacion,
      comercial_asignado_id: sql.comercialAsignadoId,
      fecha_asignacion: sql.fechaAsignacion,
      fecha_creacion: sql.fechaCreacion,
      ouv_id: sql.ouvId ?? null,
      ouv: ouvSummary,
      lead: lead as unknown as Record<string, unknown>,
      interactions: [],
      cita: cita ? this.toCitaResponse(cita) : null,
    };
  }
}
