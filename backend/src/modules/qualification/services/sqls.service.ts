import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Op, Sequelize, WhereOptions } from 'sequelize';
import { UsersService } from '../../auth/services/users.service';
import { DemandGenerationService } from '../../demand-generation/services/demand-generation.service';
import { Lead } from '../../demand-generation/models/lead.model';
import { Mql } from '../../demand-generation/models/mql.model';
import { Sql } from '../../demand-generation/models/sql.model';
import { SqlEstado } from '../../demand-generation/models/enums/sql.enums';
import type { CrearOuvDto } from '../../discovery/dtos/crear-ouv.dto';
import { OuvZona } from '../../discovery/models/enums/ouv.enums';
import { OuvsService } from '../../discovery/services/ouvs.service';
import { EntityType } from '../../workflow-engine/enums/entity-type.enum';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import { leadTextSearchWhere } from '../../demand-generation/lib/lead-text-search';
import {
  QUALIFICATION_ERROR_CODES,
  QUALIFICATION_ROLES,
} from '../constants/qualification.constants';
import {
  AssignSqlDto,
  CreateAssignedSqlCitaDto,
  CreateSqlCitaDto,
  UpdateSqlCitaDto,
} from '../dtos/assign-sql.dto';
import { UpdateMeetingStatusDto } from '../dtos/update-meeting-status.dto';
import { UpdatePlannedCitaDto } from '../dtos/update-planned-cita.dto';
import { SqlCitaEstado } from '../models/enums/sql-cita-estado.enum';
import {
  AssignSqlResponseDto,
  ConvertirSqlResponseDto,
  PaginatedSqlsResponseDto,
  SqlCitaResponseDto,
  SqlDetailDto,
  SqlsQueryDto,
} from '../dtos/sql-response.dto';
import { SqlCita } from '../models/sql-cita.model';
import { SqlInteractionsService } from './sql-interactions.service';

@Injectable()
export class SqlsService {
  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    @InjectModel(Sql) private readonly sqlModel: typeof Sql,
    @InjectModel(Lead) private readonly leadModel: typeof Lead,
    @InjectModel(SqlCita) private readonly sqlCitaModel: typeof SqlCita,
    private readonly demandGenerationService: DemandGenerationService,
    private readonly usersService: UsersService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly ouvsService: OuvsService,
    private readonly sqlInteractionsService: SqlInteractionsService,
  ) {}

  /** EARS-02 — Soporte bandeja de enrutamiento. */
  async listInbox(
    query: SqlsQueryDto,
    viewerRoleName?: string,
  ): Promise<PaginatedSqlsResponseDto> {
    this.assertSoporteOrAdmin(viewerRoleName);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const leadWhere = this.leadSearchWhere(query.q);

    const where = { estado: SqlEstado.PendienteAsignacion };

    const include = [
      {
        model: Mql,
        required: true,
        include: [
          {
            model: Lead,
            required: true,
            ...(leadWhere ? { where: leadWhere } : {}),
          },
        ],
      },
    ];

    const [rows, count] = await Promise.all([
      this.sqlModel.findAll({
        where,
        include,
        order: [['fecha_creacion', 'ASC']],
        limit,
        offset,
      }),
      this.sqlModel.count({
        where,
        include,
        distinct: true,
        col: 'sql_id',
      }),
    ]);

    const items = await Promise.all(
      rows.map((sql) => this.toDetailResponse(sql)),
    );

    return { items, total: count, page, limit };
  }

  /** Assigned SQLs — Ejecutivo sees own tray; Soporte/Admin see org-wide overview. */
  async listAssigned(
    comercialUserId: string,
    query: SqlsQueryDto,
    viewerRoleName?: string,
  ): Promise<PaginatedSqlsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const adminConvertedTray =
      viewerRoleName === 'Admin' && query.estado === 'ConvertidoOUV';
    const orgWideAssigned =
      viewerRoleName === 'SoporteComercial' ||
      adminConvertedTray ||
      (viewerRoleName === 'Admin' && !query.estado);

    const estadoFilter =
      query.estado === 'ConvertidoOUV'
        ? SqlEstado.ConvertidoOUV
        : query.estado === 'Asignado'
          ? { [Op.in]: [SqlEstado.Asignado, SqlEstado.EnGestion] }
          : { [Op.ne]: SqlEstado.PendienteAsignacion };

    const leadWhere = this.leadSearchWhere(query.q);
    const { rows, count } = await this.sqlModel.findAndCountAll({
      where: {
        ...(orgWideAssigned ? {} : { comercialAsignadoId: comercialUserId }),
        estado: estadoFilter,
      },
      include: [
        {
          model: Mql,
          required: true,
          include: [
            {
              model: Lead,
              required: true,
              ...(leadWhere ? { where: leadWhere } : {}),
            },
          ],
        },
      ],
      distinct: true,
      order: [['fechaAsignacion', 'DESC']],
      limit,
      offset,
    });

    const items = await Promise.all(
      rows.map((sql) => this.toDetailResponse(sql)),
    );

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

      if (!dto.comercial_asignado_id) {
        throw new BadRequestException({
          code: QUALIFICATION_ERROR_CODES.VALIDATION_ERROR,
          message: 'comercial_asignado_id is required when assigning a SQL',
        });
      }

      await this.assertActiveEjecutivo(dto.comercial_asignado_id);

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

      const lead = await this.demandGenerationService.findLeadById(
        sql.mql.leadId,
        soporteUserId,
        soporteRoleName,
      );
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
          payload: this.buildAssignWorkflowPayload({
            dto,
            sqlId: sql.sqlId,
            leadId: sql.mql.leadId,
            mqlId: sql.mqlId,
            assignedBy: soporteUserId,
            cita: citaDto,
          }),
          entity: { estado: estadoAnterior },
        },
        transaction,
      );

      const detail = await this.toDetailResponse(
        sql,
        lead as unknown as Record<string, unknown>,
        undefined,
        cita,
      );
      return { sql: detail, cita: citaDto };
    });
  }

  /** EARS-07 — Ejecutivo reagenda cita of own SQL. */
  async updateCita(
    sqlId: string,
    dto: UpdateSqlCitaDto,
    comercialUserId: string,
  ): Promise<SqlCitaResponseDto> {
    return this.sequelize.transaction(async (transaction) => {
      const sql = await this.findSqlOrFail(sqlId);

      if (sql.comercialAsignadoId !== comercialUserId) {
        throw new ForbiddenException({
          code: QUALIFICATION_ERROR_CODES.FORBIDDEN,
          message: 'Only the assigned Ejecutivo Comercial can reschedule the cita',
        });
      }

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

      const scheduleChanged =
        (dto.fecha !== undefined && dto.fecha !== cita.fecha) ||
        (dto.hora !== undefined &&
          this.normalizeHora(dto.hora) !== String(cita.hora).slice(0, 8));

      await cita.update(
        {
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
          ...(dto.estado !== undefined
            ? { estado: dto.estado }
            : scheduleChanged
              ? { estado: SqlCitaEstado.Reagendada }
              : {}),
        },
        { transaction },
      );

      const lead = await this.demandGenerationService.findLeadById(sql.mql.leadId);

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
          actorUserId: comercialUserId,
          payload: {
            sqlId: sql.sqlId,
            cita: this.toCitaResponse(cita),
          },
          entity: { estado: sql.estado },
        },
        transaction,
      );

      return this.toCitaResponse(cita);
    });
  }

  /** SoporteComercial reschedules the MQL-planned cita before SQL assignment. */
  async reschedulePlannedCita(
    sqlId: string,
    dto: UpdatePlannedCitaDto,
    actorUserId: string,
    actorRoleName?: string,
  ): Promise<SqlDetailDto> {
    this.assertSoporteOrAdmin(actorRoleName);

    return this.sequelize.transaction(async (transaction) => {
      const sql = await this.findSqlOrFail(sqlId, transaction);
      if (sql.estado !== SqlEstado.PendienteAsignacion) {
        throw new BadRequestException({
          code: QUALIFICATION_ERROR_CODES.SQL_NOT_PENDING,
          message: 'Only pending SQLs can reschedule the planned cita',
        });
      }

      const lead = await this.leadModel.findByPk(sql.mql.leadId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!lead) {
        throw new NotFoundException({
          code: QUALIFICATION_ERROR_CODES.NOT_FOUND,
          message: `Lead for SQL ${sqlId} not found`,
        });
      }

      await lead.update(
        {
          fechaCita: new Date(dto.fecha_cita),
          citaEstado: SqlCitaEstado.Reagendada,
          citaAgendada: true,
          ...(dto.comercial_asignado_id
            ? { comercialAsignadoId: dto.comercial_asignado_id }
            : {}),
        },
        { transaction },
      );

      const leadDto = await this.demandGenerationService.findLeadById(
        sql.mql.leadId,
        actorUserId,
        actorRoleName,
      );

      return this.toDetailResponse(
        sql,
        leadDto as unknown as Record<string, unknown>,
        undefined,
        null,
      );
    });
  }

  /** SoporteComercial cancels the MQL-planned cita before SQL assignment. */
  async cancelPlannedCita(
    sqlId: string,
    actorRoleName?: string,
  ): Promise<SqlDetailDto> {
    this.assertSoporteOrAdmin(actorRoleName);

    return this.sequelize.transaction(async (transaction) => {
      const sql = await this.findSqlOrFail(sqlId, transaction);
      if (sql.estado !== SqlEstado.PendienteAsignacion) {
        throw new BadRequestException({
          code: QUALIFICATION_ERROR_CODES.SQL_NOT_PENDING,
          message: 'Only pending SQLs can cancel the planned cita',
        });
      }

      const lead = await this.leadModel.findByPk(sql.mql.leadId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!lead) {
        throw new NotFoundException({
          code: QUALIFICATION_ERROR_CODES.NOT_FOUND,
          message: `Lead for SQL ${sqlId} not found`,
        });
      }

      await lead.update(
        {
          fechaCita: null,
          citaEstado: SqlCitaEstado.Cancelada,
          citaAgendada: false,
        },
        { transaction },
      );

      const leadDto = await this.demandGenerationService.findLeadById(
        sql.mql.leadId,
      );

      return this.toDetailResponse(
        sql,
        leadDto as unknown as Record<string, unknown>,
        undefined,
        null,
      );
    });
  }

  /** Manual meeting status (planned lead or scheduled sql_citas). */
  async updateMeetingStatus(
    sqlId: string,
    dto: UpdateMeetingStatusDto,
    actorRoleName?: string,
  ): Promise<SqlDetailDto> {
    this.assertSoporteOrAdmin(actorRoleName);

    return this.sequelize.transaction(async (transaction) => {
      const sql = await this.findSqlOrFail(sqlId, transaction);

      const cita = await this.sqlCitaModel.findOne({
        where: { sqlId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const nextEstado =
        dto.estado === null || dto.estado === undefined
          ? null
          : dto.estado;

      if (cita && nextEstado !== null) {
        await cita.update({ estado: nextEstado }, { transaction });
      }

      const lead = await this.leadModel.findByPk(sql.mql.leadId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!lead) {
        throw new NotFoundException({
          code: QUALIFICATION_ERROR_CODES.NOT_FOUND,
          message: `Lead for SQL ${sqlId} not found`,
        });
      }

      await lead.update(
        {
          citaEstado: nextEstado,
          ...(nextEstado === SqlCitaEstado.Cancelada
            ? { fechaCita: null, citaAgendada: false }
            : {}),
        },
        { transaction },
      );

      const leadDto = await this.demandGenerationService.findLeadById(
        sql.mql.leadId,
      );

      const citaAfter =
        cita ??
        (await this.sqlCitaModel.findOne({
          where: { sqlId },
          transaction,
        }));

      return this.toDetailResponse(
        sql,
        leadDto as unknown as Record<string, unknown>,
        undefined,
        citaAfter,
      );
    });
  }

  /** Cancel a scheduled sql_citas record (SoporteComercial or assigned Ejecutivo). */
  async cancelScheduledCita(
    sqlId: string,
    actorUserId: string,
    actorRoleName?: string,
  ): Promise<SqlCitaResponseDto> {
    return this.sequelize.transaction(async (transaction) => {
      const sql = await this.findSqlOrFail(sqlId, transaction);
      this.assertCanManageCita(sql, actorUserId, actorRoleName);

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

      await cita.update({ estado: SqlCitaEstado.Cancelada }, { transaction });
      return this.toCitaResponse(cita);
    });
  }

  /** EjecutivoComercial schedules a cita on an already-assigned SQL (self as commercial). */
  async createCitaForAssignedSql(
    sqlId: string,
    dto: CreateAssignedSqlCitaDto,
    comercialUserId: string,
  ): Promise<SqlCitaResponseDto> {
    return this.sequelize.transaction(async (transaction) => {
      const sql = await this.findSqlOrFail(sqlId, transaction);

      if (sql.comercialAsignadoId !== comercialUserId) {
        throw new ForbiddenException({
          code: QUALIFICATION_ERROR_CODES.FORBIDDEN,
          message: 'Only the assigned Ejecutivo Comercial can schedule the cita',
        });
      }

      if (
        sql.estado === SqlEstado.PendienteAsignacion ||
        !sql.comercialAsignadoId
      ) {
        throw new BadRequestException({
          code: QUALIFICATION_ERROR_CODES.SQL_NOT_ASSIGNED,
          message: 'SQL must be assigned before scheduling a cita',
        });
      }

      const cita = await this.createCita(
        sql.sqlId,
        dto,
        comercialUserId,
        transaction,
      );

      return this.toCitaResponse(cita);
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

    return this.sqlCitaModel.create(
      {
        sqlId,
        lugar: dto.lugar,
        fecha: dto.fecha,
        hora: this.normalizeHora(dto.hora),
        contactoNombre: dto.contacto_nombre,
        contactoCargo: dto.contacto_cargo ?? null,
        descripcion: dto.descripcion ?? null,
        estado: SqlCitaEstado.Agendada,
        agendadaPor,
      },
      { transaction },
    );
  }

  private leadSearchWhere(q?: string): WhereOptions<Lead> | undefined {
    return leadTextSearchWhere(this.sequelize, q);
  }

  private async assertActiveEjecutivo(userId: string): Promise<void> {
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
  }

  private assertSoporteOrAdmin(roleName?: string): void {
    if (
      roleName === QUALIFICATION_ROLES.SOPORTE_COMERCIAL ||
      roleName === 'Admin'
    ) {
      return;
    }
    throw new ForbiddenException({
      code: QUALIFICATION_ERROR_CODES.FORBIDDEN,
      message: 'Only SoporteComercial can access the routing inbox / assign',
    });
  }

  private assertCanViewSql(
    sql: Sql,
    viewerUserId: string,
    viewerRoleName?: string,
  ): void {
    if (viewerRoleName === QUALIFICATION_ROLES.SOPORTE_COMERCIAL) {
      return;
    }
    if (viewerRoleName === 'Admin') {
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

  private assertCanManageCita(
    sql: Sql,
    actorUserId: string,
    actorRoleName?: string,
  ): void {
    if (
      actorRoleName === QUALIFICATION_ROLES.SOPORTE_COMERCIAL ||
      actorRoleName === 'Admin'
    ) {
      return;
    }
    if (sql.comercialAsignadoId === actorUserId) {
      return;
    }
    throw new ForbiddenException({
      code: QUALIFICATION_ERROR_CODES.FORBIDDEN,
      message: 'Not allowed to manage this cita',
    });
  }

  private async findSqlOrFail(
    sqlId: string,
    transaction?: import('sequelize').Transaction,
  ): Promise<Sql> {
    const sql = await this.sqlModel.findByPk(sqlId, {
      include: [{ model: Mql, required: true }],
      ...(transaction
        ? { transaction, lock: transaction.LOCK.UPDATE }
        : {}),
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

  /** JSON-safe workflow payload — no full lead/interaction graphs. */
  private buildAssignWorkflowPayload(input: {
    dto: AssignSqlDto;
    sqlId: string;
    leadId: string;
    mqlId: string;
    assignedBy: string;
    cita: SqlCitaResponseDto | null;
  }): Record<string, unknown> {
    return {
      comercial_asignado_id: input.dto.comercial_asignado_id,
      sqlId: input.sqlId,
      leadId: input.leadId,
      mqlId: input.mqlId,
      assignedBy: input.assignedBy,
      ...(input.cita
        ? {
            cita: {
              cita_id: input.cita.cita_id,
              sql_id: input.cita.sql_id,
              lugar: input.cita.lugar,
              fecha: input.cita.fecha,
              hora: input.cita.hora,
              contacto_nombre: input.cita.contacto_nombre,
              contacto_cargo: input.cita.contacto_cargo,
              agendada_por: input.cita.agendada_por,
            },
          }
        : {}),
    };
  }

  private toCitaPlanificadaResponse(
    lead: Record<string, unknown>,
  ): SqlDetailDto['cita_planificada'] {
    const fechaCita = lead.fecha_cita;
    const comercialId = lead.comercial_asignado_id;
    const citaEstado = lead.cita_estado;
    const hasFecha =
      fechaCita instanceof Date ||
      (typeof fechaCita === 'string' && fechaCita.length > 0);
    const hasComercial =
      typeof comercialId === 'string' && comercialId.length > 0;
    const hasEstado =
      typeof citaEstado === 'string' && citaEstado.length > 0;
    if (!hasFecha && !hasComercial && !hasEstado) {
      return null;
    }
    return {
      fecha_cita:
        fechaCita instanceof Date
          ? fechaCita
          : typeof fechaCita === 'string'
            ? new Date(fechaCita)
            : null,
      comercial_asignado_id:
        typeof comercialId === 'string' ? comercialId : null,
      cita_estado: typeof citaEstado === 'string' ? citaEstado : null,
    };
  }

  private toCitaResponse(cita: SqlCita): SqlCitaResponseDto {
    return {
      cita_id: cita.citaId,
      sql_id: cita.sqlId,
      lugar: cita.lugar,
      fecha: cita.fecha,
      hora: String(cita.hora).slice(0, 8),
      contacto_nombre: cita.contactoNombre,
      contacto_cargo: cita.contactoCargo,
      descripcion: cita.descripcion,
      estado: cita.estado ?? SqlCitaEstado.Agendada,
      agendada_por: cita.agendadaPor,
      created_at: cita.createdAt,
      updated_at: cita.updatedAt,
    };
  }

  private async toDetailResponse(
    sql: Sql,
    leadDto?: Record<string, unknown>,
    interactionsDto?: SqlDetailDto['interactions'],
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
    const interactions =
      interactionsDto ??
      (await this.sqlInteractionsService.listBySql(sql.sqlId));

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
      interactions,
      cita_planificada: this.toCitaPlanificadaResponse(lead),
      cita: cita ? this.toCitaResponse(cita) : null,
    };
  }
}
