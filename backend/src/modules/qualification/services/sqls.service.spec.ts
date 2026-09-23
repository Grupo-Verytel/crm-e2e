import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataTypes, Model, Sequelize } from 'sequelize';
import { AuditHooksService } from '../../audit/services/audit-hooks.service';
import { AuditAction } from '../../audit/models/audit-action.enum';
import type { AuditWriteEntry } from '../../audit/services/audit-write-entry.interface';
import { UsersService } from '../../auth/services/users.service';
import { DemandGenerationService } from '../../demand-generation/services/demand-generation.service';
import { SqlEstado } from '../../demand-generation/models/enums/sql.enums';
import { Sql } from '../../demand-generation/models/sql.model';
import { OuvsService } from '../../discovery/services/ouvs.service';
import { GraphService } from '../../graph-integration/services/graph.service';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import { CreateAssignedSqlCitaDto } from '../dtos/assign-sql.dto';
import { SqlCita } from '../models/sql-cita.model';
import { SqlsService } from './sqls.service';

const SQL_ID = 'sql-1';
const COMERCIAL_ID = 'ejec-1';
const SOPORTE_ID = 'soporte-1';

const dto: CreateAssignedSqlCitaDto = {
  lugar: 'Microsoft Teams',
  fecha: '2099-01-15',
  hora: '10:00',
  contacto_nombre: 'Ana',
  contacto_email: 'ana@cliente.com',
  contacto_telefono: '3001234567',
  contactos: [
    {
      nombre: 'Ana',
      email: 'ana@cliente.com',
      telefono: '3001234567',
    },
  ],
};

describe('SqlsService.createCitaForAssignedSql', () => {
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };

  function createService(options?: {
    estado?: SqlEstado;
    comercialAsignadoId?: string | null;
    existing?: Record<string, unknown> | null;
  }) {
    const sqlUpdate = jest.fn();
    const sql = {
      sqlId: SQL_ID,
      estado: options?.estado ?? SqlEstado.Asignado,
      comercialAsignadoId:
        options && 'comercialAsignadoId' in options
          ? options.comercialAsignadoId
          : COMERCIAL_ID,
      fechaAsignacion: new Date('2026-09-01T15:00:00.000Z'),
      mql: { leadId: 'lead-1' },
      update: sqlUpdate,
    };

    const existingUpdate = jest.fn(async (values: Record<string, unknown>) => {
      Object.assign(existingRow, values);
      return existingRow;
    });
    const existingRow = {
      citaId: 'cita-old',
      sqlId: SQL_ID,
      lugar: 'Sala',
      fecha: '2000-01-01',
      hora: '08:00:00',
      contactoNombre: 'Ana',
      contactoEmail: 'ana@cliente.com',
      contactoTelefono: '3001234567',
      contactos: dto.contactos,
      contactoCargo: null,
      descripcion: null,
      agendadaPor: 'alguien',
      graphEventId: 'evt-old',
      graphOrganizerUpn: 'kam@frisson.net.co',
      teamsJoinUrl: 'https://teams.example/old',
      durationMinutes: 60,
      createdAt: new Date('2000-01-01T13:00:00.000Z'),
      updatedAt: new Date('2000-01-01T13:00:00.000Z'),
      update: existingUpdate,
      ...(options?.existing ?? {}),
    };

    const createdUpdate = jest.fn(async (values: Record<string, unknown>) => {
      Object.assign(createdRow, values);
      return createdRow;
    });
    const createdRow: Record<string, unknown> = {
      citaId: 'cita-new',
      createdAt: new Date('2026-09-23T15:00:00.000Z'),
      updatedAt: new Date('2026-09-23T15:00:00.000Z'),
      graphEventId: null,
      graphOrganizerUpn: null,
      teamsJoinUrl: null,
      update: createdUpdate,
    };

    const sqlModel = {
      findByPk: jest.fn().mockResolvedValue(sql),
    };
    const sqlCitaModel = {
      findOne: jest.fn().mockResolvedValue(options?.existing === null ? null : existingRow),
      create: jest.fn(async (values: Record<string, unknown>) => {
        Object.assign(createdRow, values);
        return createdRow;
      }),
    };
    const createMeeting = jest.fn().mockResolvedValue({
      eventId: 'evt-new',
      organizer: { email: 'kam@frisson.net.co' },
      joinUrl: 'https://teams.example/new',
    });
    const updateMeeting = jest.fn();

    const service = new SqlsService(
      {
        transaction: jest.fn(async (work: (tx: typeof transaction) => unknown) =>
          work(transaction),
        ),
      } as unknown as Sequelize,
      sqlModel as unknown as typeof Sql,
      sqlCitaModel as unknown as typeof SqlCita,
      {
        findLeadById: jest.fn().mockResolvedValue({
          name: 'Acme',
          empresa_nombre: 'Acme',
        }),
        listInteractions: jest.fn(),
      } as unknown as DemandGenerationService,
      {
        findActiveByRoleName: jest.fn().mockResolvedValue([
          {
            user_id: COMERCIAL_ID,
            email: 'kam@frisson.net.co',
            full_name: 'Kam',
          },
        ]),
      } as unknown as UsersService,
      { transition: jest.fn() } as unknown as WorkflowEngineService,
      { findById: jest.fn() } as unknown as OuvsService,
      {
        domains: ['frisson.net.co', 'grupovertyel.com'],
        timeZone: 'America/Bogota',
        createMeeting,
        updateMeeting,
      } as unknown as GraphService,
    );

    return {
      service,
      sql,
      sqlUpdate,
      existingRow,
      existingUpdate,
      createdUpdate,
      createMeeting,
      updateMeeting,
      sqlCitaModel,
    };
  }

  it('SoporteComercial creates a Teams meeting and a sql_citas row without reassigning the SQL', async () => {
    const ctx = createService({ existing: null });

    const cita = await ctx.service.createCitaForAssignedSql(
      SQL_ID,
      dto,
      SOPORTE_ID,
      'SoporteComercial',
    );

    expect(ctx.sqlUpdate).not.toHaveBeenCalled();
    expect(ctx.sql.comercialAsignadoId).toBe(COMERCIAL_ID);
    expect(ctx.sql.estado).toBe(SqlEstado.Asignado);
    expect(ctx.createMeeting).toHaveBeenCalledTimes(1);
    expect(ctx.updateMeeting).not.toHaveBeenCalled();
    expect(ctx.sqlCitaModel.create).toHaveBeenCalled();
    expect(cita.graph_event_id).toBe('evt-new');
    expect(cita.teams_join_url).toBe('https://teams.example/new');
    expect(cita.vigente).toBe(true);
  });

  it('replaces a past cita with a new Teams event and leaves the old event untouched', async () => {
    const ctx = createService();

    const cita = await ctx.service.createCitaForAssignedSql(
      SQL_ID,
      dto,
      COMERCIAL_ID,
      'EjecutivoComercial',
    );

    expect(ctx.updateMeeting).not.toHaveBeenCalled();
    expect(ctx.createMeeting).toHaveBeenCalledTimes(1);
    expect(ctx.sqlCitaModel.create).not.toHaveBeenCalled();
    expect(ctx.existingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        fecha: '2099-01-15',
        hora: '10:00:00',
        graphEventId: 'evt-new',
        teamsJoinUrl: 'https://teams.example/new',
      }),
      expect.anything(),
    );
    expect(ctx.sqlUpdate).not.toHaveBeenCalled();
    expect(cita.graph_event_id).toBe('evt-new');
    expect(cita.vigente).toBe(true);
  });

  it('rejects a vigente cita with CITA_VIGENTE_EXISTS and does not call Teams', async () => {
    const ctx = createService({
      existing: {
        fecha: '2099-06-01',
        hora: '09:00:00',
        graphEventId: 'evt-live',
      },
    });

    await expect(
      ctx.service.createCitaForAssignedSql(
        SQL_ID,
        dto,
        COMERCIAL_ID,
        'EjecutivoComercial',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    try {
      await ctx.service.createCitaForAssignedSql(
        SQL_ID,
        dto,
        SOPORTE_ID,
        'SoporteComercial',
      );
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'CITA_VIGENTE_EXISTS',
      });
    }

    expect(ctx.createMeeting).not.toHaveBeenCalled();
    expect(ctx.updateMeeting).not.toHaveBeenCalled();
    expect(ctx.existingUpdate).not.toHaveBeenCalled();
  });

  it('rejects an Ejecutivo who is not the assigned commercial', async () => {
    const ctx = createService({ existing: null });

    await expect(
      ctx.service.createCitaForAssignedSql(
        SQL_ID,
        dto,
        'otro-ejec',
        'EjecutivoComercial',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(ctx.createMeeting).not.toHaveBeenCalled();
  });

  it('rejects scheduling when the SQL is not Asignado', async () => {
    const ctx = createService({
      estado: SqlEstado.ConvertidoOUV,
      existing: null,
    });

    await expect(
      ctx.service.createCitaForAssignedSql(
        SQL_ID,
        dto,
        SOPORTE_ID,
        'SoporteComercial',
      ),
    ).rejects.toMatchObject({
      response: { code: 'SQL_NOT_ASSIGNED' },
    });

    expect(ctx.createMeeting).not.toHaveBeenCalled();
  });
});

describe('createCitaForAssignedSql audit hook', () => {
  const graphMeeting = {
    eventId: 'evt-new',
    organizer: { email: 'kam@frisson.net.co' },
    joinUrl: 'https://teams.example/new',
  };

  it('SoporteComercial replacing a past cita writes UPDATE audit rows for fecha, hora, link and graph_event_id', async () => {
    const sequelize = new Sequelize('mysql://unused:unused@127.0.0.1:1/unused', {
      dialect: 'mysql',
      logging: false,
    });

    class CitaRow extends Model {
      declare citaId: string;
      declare sqlId: string;
      declare lugar: string;
      declare fecha: string;
      declare hora: string;
      declare contactoNombre: string;
      declare contactoEmail: string | null;
      declare contactoTelefono: string | null;
      declare contactos: unknown;
      declare contactoCargo: string | null;
      declare descripcion: string | null;
      declare agendadaPor: string;
      declare graphEventId: string | null;
      declare graphOrganizerUpn: string | null;
      declare teamsJoinUrl: string | null;
      declare durationMinutes: number;
    }

    CitaRow.init(
      {
        citaId: { type: DataTypes.CHAR(36), primaryKey: true, field: 'cita_id' },
        sqlId: { type: DataTypes.CHAR(36), field: 'sql_id' },
        lugar: { type: DataTypes.STRING(200) },
        fecha: { type: DataTypes.STRING(10) },
        hora: { type: DataTypes.STRING(8) },
        contactoNombre: { type: DataTypes.STRING(120), field: 'contacto_nombre' },
        contactoEmail: { type: DataTypes.STRING(160), field: 'contacto_email' },
        contactoTelefono: { type: DataTypes.STRING(40), field: 'contacto_telefono' },
        contactos: { type: DataTypes.JSON },
        contactoCargo: { type: DataTypes.STRING(100), field: 'contacto_cargo' },
        descripcion: { type: DataTypes.TEXT },
        agendadaPor: { type: DataTypes.CHAR(36), field: 'agendada_por' },
        graphEventId: { type: DataTypes.STRING(512), field: 'graph_event_id' },
        graphOrganizerUpn: { type: DataTypes.STRING(255), field: 'graph_organizer_upn' },
        teamsJoinUrl: { type: DataTypes.TEXT, field: 'teams_join_url' },
        durationMinutes: { type: DataTypes.INTEGER, field: 'duration_minutes' },
      },
      { sequelize, tableName: 'sql_citas', timestamps: true, underscored: true },
    );

    const writes: AuditWriteEntry[] = [];
    new AuditHooksService(sequelize, {
      write: async (entry: AuditWriteEntry) => {
        writes.push(entry);
      },
    } as never).onModuleInit();

    sequelize.getQueryInterface().update = async (instance: Model) => [instance, 1];
    sequelize.transaction = (async (
      work: (tx: { LOCK: { UPDATE: string } }) => Promise<unknown>,
    ) => work({ LOCK: { UPDATE: 'UPDATE' } })) as never;

    const row = CitaRow.build(
      {
        citaId: 'cita-old',
        sqlId: SQL_ID,
        lugar: 'Sala',
        fecha: '2000-01-01',
        hora: '08:00:00',
        contactoNombre: 'Ana',
        contactoEmail: 'ana@cliente.com',
        contactoTelefono: '3001234567',
        contactos: dto.contactos,
        contactoCargo: null,
        descripcion: null,
        agendadaPor: 'alguien',
        graphEventId: 'evt-old',
        graphOrganizerUpn: 'kam@frisson.net.co',
        teamsJoinUrl: 'https://teams.example/old',
        durationMinutes: 60,
      },
      { isNewRecord: false },
    );
    jest.spyOn(CitaRow, 'findOne').mockResolvedValue(row);

    const service = new SqlsService(
      sequelize,
      {
        findByPk: jest.fn().mockResolvedValue({
          sqlId: SQL_ID,
          estado: SqlEstado.Asignado,
          comercialAsignadoId: COMERCIAL_ID,
          mql: { leadId: 'lead-1' },
          update: jest.fn(),
        }),
      } as unknown as typeof Sql,
      CitaRow as unknown as typeof SqlCita,
      {
        findLeadById: jest.fn().mockResolvedValue({ name: 'Acme' }),
      } as unknown as DemandGenerationService,
      {
        findActiveByRoleName: jest.fn().mockResolvedValue([
          {
            user_id: COMERCIAL_ID,
            email: 'kam@frisson.net.co',
            full_name: 'Kam',
          },
        ]),
      } as unknown as UsersService,
      { transition: jest.fn() } as unknown as WorkflowEngineService,
      { findById: jest.fn() } as unknown as OuvsService,
      {
        domains: ['frisson.net.co', 'grupovertyel.com'],
        timeZone: 'America/Bogota',
        createMeeting: jest.fn().mockResolvedValue(graphMeeting),
        updateMeeting: jest.fn(),
      } as unknown as GraphService,
    );

    await service.createCitaForAssignedSql(
      SQL_ID,
      dto,
      SOPORTE_ID,
      'SoporteComercial',
    );

    const updates = writes.filter((entry) => entry.accion === AuditAction.UPDATE);
    const byField = new Map(updates.map((entry) => [entry.campoModificado, entry]));

    expect(byField.get('fecha')).toMatchObject({
      tabla: 'sql_citas',
      registroId: 'cita-old',
      valorAnterior: JSON.stringify('2000-01-01'),
      valorNuevo: JSON.stringify('2099-01-15'),
    });
    expect(byField.get('hora')).toMatchObject({
      valorAnterior: JSON.stringify('08:00:00'),
      valorNuevo: JSON.stringify('10:00:00'),
    });
    expect(byField.get('teams_join_url')).toMatchObject({
      valorAnterior: JSON.stringify('https://teams.example/old'),
      valorNuevo: JSON.stringify('https://teams.example/new'),
    });
    expect(byField.get('graph_event_id')).toMatchObject({
      valorAnterior: JSON.stringify('evt-old'),
      valorNuevo: JSON.stringify('evt-new'),
    });

    await sequelize.close();
  });
});
