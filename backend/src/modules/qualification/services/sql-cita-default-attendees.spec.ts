import { BadRequestException } from '@nestjs/common';
import { Sequelize } from 'sequelize';
import { UsersService } from '../../auth/services/users.service';
import { SqlEstado } from '../../demand-generation/models/enums/sql.enums';
import { Sql } from '../../demand-generation/models/sql.model';
import { DemandGenerationService } from '../../demand-generation/services/demand-generation.service';
import { OuvsService } from '../../discovery/services/ouvs.service';
import { GraphService } from '../../graph-integration/services/graph.service';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import { CreateAssignedSqlCitaDto } from '../dtos/assign-sql.dto';
import { DefaultMeetingAttendee } from '../models/default-meeting-attendee.model';
import { SqlCitaEstado } from '../models/enums/sql-cita-estado.enum';
import { SqlAppointmentEvent } from '../models/sql-appointment-event.model';
import { SqlCita } from '../models/sql-cita.model';
import {
  SqlCitaAttendee,
  SqlCitaAttendeeSource,
} from '../models/sql-cita-attendee.model';
import { SqlsService } from './sqls.service';

const SQL_ID = 'sql-1';
const COMERCIAL_ID = 'ejec-1';
const SOPORTE_ID = 'soporte-1';
const ORGANIZER = 'kam@frisson.net.co';

const citaDto: CreateAssignedSqlCitaDto = {
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

type DefaultRow = {
  email: string;
  name: string | null;
  sortOrder: number;
};

type SnapshotRow = {
  sqlCitaAttendeeId: string;
  citaId: string;
  email: string;
  name: string | null;
  userId: string | null;
  source: SqlCitaAttendeeSource;
  sortOrder: number;
};

const THREE_DEFAULTS: DefaultRow[] = [
  { email: 'Zeta@GrupoVerytel.com', name: 'Zeta', sortOrder: 3 },
  { email: 'erobles@grupoverytel.com', name: 'Elena', sortOrder: 1 },
  { email: ORGANIZER, name: 'Kam', sortOrder: 2 },
];

function snapshotFrom(rows: Array<Record<string, unknown>>): SnapshotRow[] {
  return rows.map((row, index) => ({
    sqlCitaAttendeeId: `att-${index + 1}`,
    citaId: String(row.citaId),
    email: String(row.email),
    name: (row.name as string | null) ?? null,
    userId: (row.userId as string | null) ?? null,
    source: row.source as SqlCitaAttendeeSource,
    sortOrder: Number(row.sortOrder),
  }));
}

function build(options?: {
  defaults?: DefaultRow[];
  users?: Record<string, { user_id: string } | null>;
  existing?: Record<string, unknown> | null;
  snapshot?: SnapshotRow[];
  insertFails?: boolean;
  sqlEstado?: SqlEstado;
  findByEmailError?: boolean;
}) {
  const order: string[] = [];
  const sql = {
    sqlId: SQL_ID,
    estado: options?.sqlEstado ?? SqlEstado.Asignado,
    comercialAsignadoId: COMERCIAL_ID,
    fechaAsignacion: new Date('2026-09-01T15:00:00.000Z'),
    fechaCreacion: new Date('2026-08-01T15:00:00.000Z'),
    enBacklog: false,
    origenCreacion: 'enrutamiento_normal',
    ouvId: null,
    mql: { leadId: 'lead-1' },
    mqlId: 'mql-1',
    update: jest.fn(),
  };
  const existingUpdate = jest.fn(async (values: Record<string, unknown>) => {
    Object.assign(existingRow, values);
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
    contactos: citaDto.contactos,
    contactoCargo: null,
    descripcion: null,
    agendadaPor: SOPORTE_ID,
    estado: SqlCitaEstado.Agendada,
    graphEventId: 'evt-old',
    graphOrganizerUpn: ORGANIZER,
    teamsJoinUrl: 'https://teams.example/old',
    durationMinutes: 60,
    createdAt: new Date('2000-01-01T13:00:00.000Z'),
    updatedAt: new Date('2000-01-01T13:00:00.000Z'),
    update: existingUpdate,
    ...(options?.existing ?? {}),
  };
  const createdUpdate = jest.fn(async (values: Record<string, unknown>) => {
    Object.assign(createdRow, values);
  });
  const createdRow: Record<string, unknown> = {
    citaId: 'cita-new',
    sqlId: SQL_ID,
    lugar: citaDto.lugar,
    fecha: '2099-01-15',
    hora: '10:00:00',
    contactoNombre: 'Ana',
    contactoEmail: 'ana@cliente.com',
    contactoTelefono: '3001234567',
    contactos: citaDto.contactos,
    contactoCargo: null,
    descripcion: null,
    agendadaPor: SOPORTE_ID,
    estado: SqlCitaEstado.Agendada,
    graphEventId: null,
    graphOrganizerUpn: null,
    teamsJoinUrl: null,
    durationMinutes: 60,
    createdAt: new Date('2026-10-29T15:00:00.000Z'),
    updatedAt: new Date('2026-10-29T15:00:00.000Z'),
    update: createdUpdate,
  };

  const sqlCitaModel = {
    findOne: jest
      .fn()
      .mockResolvedValue(options?.existing === null ? null : existingRow),
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn(async (values: Record<string, unknown>) => {
      order.push('create-cita');
      Object.assign(createdRow, values);
      return createdRow;
    }),
  };
  const destroy = jest.fn(async () => {
    order.push('destroy-snapshot');
    return 0;
  });
  const bulkCreate = jest.fn(async (rows: Array<Record<string, unknown>>) => {
    order.push('insert-snapshot');
    if (options?.insertFails) {
      throw new Error('snapshot insert failed');
    }
    return snapshotFrom(rows);
  });
  const attendeeFindAll = jest
    .fn()
    .mockResolvedValue(options?.snapshot ?? []);
  const createMeeting = jest.fn(async () => {
    order.push('graph');
    return {
      eventId: 'evt-new',
      organizer: { email: ORGANIZER },
      joinUrl: 'https://teams.example/new',
    };
  });
  const updateMeeting = jest.fn(async () => {
    order.push('graph-update');
    return {};
  });
  const defaultFindAll = jest
    .fn()
    .mockResolvedValue(options?.defaults ?? []);

  let committed = false;
  const service = new SqlsService(
    {
      transaction: jest.fn(async (work: (tx: { LOCK: { UPDATE: string } }) => Promise<unknown>) => {
        try {
          const result = await work({ LOCK: { UPDATE: 'UPDATE' } });
          committed = true;
          return result;
        } catch (error) {
          committed = false;
          throw error;
        }
      }),
    } as unknown as Sequelize,
    { findByPk: jest.fn().mockResolvedValue(sql) } as unknown as typeof Sql,
    sqlCitaModel as unknown as typeof SqlCita,
    { create: jest.fn() } as unknown as typeof SqlAppointmentEvent,
    {
      findLeadById: jest.fn().mockResolvedValue({
        name: 'Acme',
        empresa_nombre: 'Acme',
      }),
      listInteractions: jest.fn().mockResolvedValue([]),
    } as unknown as DemandGenerationService,
    {
      findActiveByRoleName: jest.fn().mockResolvedValue([
        {
          user_id: COMERCIAL_ID,
          email: ORGANIZER,
          full_name: 'Kam',
        },
      ]),
      findById: jest.fn().mockResolvedValue({
        user_id: SOPORTE_ID,
        email: 'soporte@frisson.net.co',
        full_name: 'Soporte',
        role_name: 'SoporteComercial',
      }),
      findByEmail: jest.fn(async (email: string) => {
        if (options?.findByEmailError) {
          throw new Error('directory down');
        }
        return options?.users?.[email] ?? null;
      }),
    } as unknown as UsersService,
    { transition: jest.fn() } as unknown as WorkflowEngineService,
    { findById: jest.fn() } as unknown as OuvsService,
    {
      domains: ['frisson.net.co', 'grupovertyel.com'],
      timeZone: 'America/Bogota',
      createMeeting,
      updateMeeting,
      cancelMeeting: jest.fn(),
    } as unknown as GraphService,
    { findAll: defaultFindAll } as unknown as typeof DefaultMeetingAttendee,
    {
      findAll: attendeeFindAll,
      bulkCreate,
      destroy,
    } as unknown as typeof SqlCitaAttendee,
  );

  return {
    service,
    sql,
    order,
    createMeeting,
    updateMeeting,
    bulkCreate,
    destroy,
    defaultFindAll,
    attendeeFindAll,
    sqlCitaModel,
    existingRow,
    wasCommitted: () => committed,
  };
}

describe('SQL cita default attendees', () => {
  it('REQ-01 REQ-06: copies active defaults in sort order, links the user, and omits the organizer from Graph', async () => {
    const ctx = build({
      defaults: THREE_DEFAULTS,
      users: {
        'erobles@grupoverytel.com': { user_id: 'user-elena' },
      },
      existing: null,
    });

    const cita = await ctx.service.createCitaForAssignedSql(
      SQL_ID,
      citaDto,
      SOPORTE_ID,
      'SoporteComercial',
    );

    expect(ctx.bulkCreate).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          email: 'erobles@grupoverytel.com',
          name: 'Elena',
          sortOrder: 1,
          userId: 'user-elena',
          source: SqlCitaAttendeeSource.Default,
        }),
        expect.objectContaining({
          email: ORGANIZER,
          userId: null,
          sortOrder: 2,
        }),
        expect.objectContaining({
          email: 'zeta@grupoverytel.com',
          sortOrder: 3,
          userId: null,
        }),
      ],
      expect.objectContaining({ individualHooks: true }),
    );
    const graphAttendees = ctx.createMeeting.mock.calls[0][0].attendees as Array<{
      email: string;
    }>;
    expect(graphAttendees.map((row) => row.email)).toEqual([
      'ana@cliente.com',
      'soporte@frisson.net.co',
      'erobles@grupoverytel.com',
      'zeta@grupoverytel.com',
    ]);
    expect(graphAttendees.some((row) => row.email === ORGANIZER)).toBe(false);
    expect(cita.attendees.map((row) => row.email)).toEqual([
      'erobles@grupoverytel.com',
      ORGANIZER,
      'zeta@grupoverytel.com',
    ]);
    expect(cita.attendees[0].user_id).toBe('user-elena');
    expect(cita.attendees[1].user_id).toBeNull();
  });

  it('REQ-02: an empty default list schedules the cita with no snapshot rows', async () => {
    const ctx = build({ defaults: [], existing: null });
    const cita = await ctx.service.createCitaForAssignedSql(
      SQL_ID,
      citaDto,
      SOPORTE_ID,
      'SoporteComercial',
    );
    expect(ctx.bulkCreate).not.toHaveBeenCalled();
    expect(cita.attendees).toEqual([]);
    expect(ctx.createMeeting.mock.calls[0][0].attendees).toEqual([
      { email: 'ana@cliente.com', name: 'Ana', type: 'required' },
      { email: 'soporte@frisson.net.co', name: 'Soporte', type: 'required' },
    ]);
  });

  it('REQ-03: does not insert the same email twice on one cita', async () => {
    const ctx = build({
      defaults: [
        { email: 'erobles@grupoverytel.com', name: 'Elena', sortOrder: 1 },
        { email: 'Erobles@grupoverytel.com', name: 'Otra', sortOrder: 2 },
      ],
      existing: null,
    });
    await ctx.service.createCitaForAssignedSql(
      SQL_ID,
      citaDto,
      SOPORTE_ID,
      'SoporteComercial',
    );
    const rows = ctx.bulkCreate.mock.calls[0][0] as Array<{ email: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('erobles@grupoverytel.com');
  });

  it('REQ-04: a failed snapshot insert rolls the assign transaction back before Graph', async () => {
    const ctx = build({
      defaults: [
        { email: 'erobles@grupoverytel.com', name: null, sortOrder: 1 },
      ],
      insertFails: true,
      sqlEstado: SqlEstado.PendienteAsignacion,
      existing: null,
    });

    await expect(
      ctx.service.assign(
        SQL_ID,
        { comercial_asignado_id: COMERCIAL_ID, cita: citaDto },
        SOPORTE_ID,
        'SoporteComercial',
      ),
    ).rejects.toThrow('snapshot insert failed');

    expect(ctx.order).toEqual(['create-cita', 'insert-snapshot']);
    expect(ctx.createMeeting).not.toHaveBeenCalled();
    expect(ctx.wasCommitted()).toBe(false);
  });

  it('REQ-05 REQ-10: detail returns the stored snapshot and does not read the live list', async () => {
    const ctx = build({
      defaults: [
        { email: 'nuevo@grupoverytel.com', name: 'Nuevo', sortOrder: 1 },
      ],
      snapshot: [
        {
          sqlCitaAttendeeId: 'att-old',
          citaId: 'cita-old',
          email: 'erobles@grupoverytel.com',
          name: 'Elena',
          userId: 'user-elena',
          source: SqlCitaAttendeeSource.Default,
          sortOrder: 1,
        },
      ],
    });

    const detail = await ctx.service.findById(SQL_ID, 'admin-1', 'Admin');

    expect(ctx.defaultFindAll).not.toHaveBeenCalled();
    expect(detail.cita?.attendees).toEqual([
      {
        sql_cita_attendee_id: 'att-old',
        email: 'erobles@grupoverytel.com',
        name: 'Elena',
        user_id: 'user-elena',
        source: 'default',
        sort_order: 1,
      },
    ]);
  });

  it('REQ-07: PATCH keeps the snapshot and sends those emails to Graph', async () => {
    const ctx = build({
      defaults: [
        { email: 'nuevo@grupoverytel.com', name: 'Nuevo', sortOrder: 1 },
      ],
      snapshot: [
        {
          sqlCitaAttendeeId: 'att-old',
          citaId: 'cita-old',
          email: 'viejo@grupoverytel.com',
          name: null,
          userId: null,
          source: SqlCitaAttendeeSource.Default,
          sortOrder: 1,
        },
      ],
      existing: { fecha: '2099-02-01', hora: '09:00:00' },
    });

    const cita = await ctx.service.updateCita(
      SQL_ID,
      { lugar: 'Microsoft Teams' },
      SOPORTE_ID,
      'SoporteComercial',
    );

    expect(ctx.defaultFindAll).not.toHaveBeenCalled();
    expect(ctx.destroy).not.toHaveBeenCalled();
    expect(ctx.bulkCreate).not.toHaveBeenCalled();
    expect(cita.attendees.map((row) => row.sql_cita_attendee_id)).toEqual([
      'att-old',
    ]);
    const graphAttendees = ctx.updateMeeting.mock.calls[0][1].attendees as Array<{
      email: string;
      name?: string;
    }>;
    expect(graphAttendees.map((row) => row.email)).toContain(
      'viejo@grupoverytel.com',
    );
    expect(graphAttendees.map((row) => row.email)).not.toContain(
      'nuevo@grupoverytel.com',
    );
    expect(
      graphAttendees.find((row) => row.email === 'viejo@grupoverytel.com')?.name,
    ).toBeUndefined();
  });

  it('REQ-08: reusing a non-vigente cita replaces the snapshot and Graph uses the new list', async () => {
    const ctx = build({
      defaults: [
        { email: 'nuevo@grupoverytel.com', name: 'Nuevo', sortOrder: 1 },
      ],
      existing: { fecha: '2000-01-01', estado: SqlCitaEstado.Realizada },
    });

    const cita = await ctx.service.createCitaForAssignedSql(
      SQL_ID,
      citaDto,
      SOPORTE_ID,
      'SoporteComercial',
    );

    expect(ctx.order).toEqual(['graph', 'destroy-snapshot', 'insert-snapshot']);
    expect(ctx.bulkCreate.mock.calls[0][0]).toEqual([
      expect.objectContaining({ email: 'nuevo@grupoverytel.com', citaId: 'cita-old' }),
    ]);
    expect(cita.attendees.map((row) => row.email)).toEqual([
      'nuevo@grupoverytel.com',
    ]);
    const graphAttendees = ctx.createMeeting.mock.calls[0][0].attendees as Array<{
      email: string;
    }>;
    expect(graphAttendees.map((row) => row.email)).toContain(
      'nuevo@grupoverytel.com',
    );
  });

  it('REQ-08: a vigente cita is rejected and its snapshot is left untouched', async () => {
    const ctx = build({
      defaults: [
        { email: 'nuevo@grupoverytel.com', name: null, sortOrder: 1 },
      ],
      existing: { fecha: '2099-06-01', hora: '11:00:00', estado: SqlCitaEstado.Agendada },
    });

    await expect(
      ctx.service.createCitaForAssignedSql(
        SQL_ID,
        citaDto,
        SOPORTE_ID,
        'SoporteComercial',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(ctx.createMeeting).not.toHaveBeenCalled();
    expect(ctx.destroy).not.toHaveBeenCalled();
    expect(ctx.bulkCreate).not.toHaveBeenCalled();
  });

  it('REQ-09: cancel destroys the cita and does not delete attendees in the service', async () => {
    const ctx = build({
      existing: {
        fecha: '2099-06-01',
        hora: '11:00:00',
        estado: SqlCitaEstado.Agendada,
        graphEventId: null,
        destroy: jest.fn(async () => undefined),
      },
    });

    await ctx.service.cancelCitaForAssignedSql(
      SQL_ID,
      SOPORTE_ID,
      'SoporteComercial',
    );

    expect(ctx.existingRow.destroy).toHaveBeenCalledTimes(1);
    expect(ctx.destroy).not.toHaveBeenCalled();
  });

  it('assign sends Graph only after the cita and the snapshot exist', async () => {
    const ctx = build({
      defaults: [
        { email: 'erobles@grupoverytel.com', name: null, sortOrder: 1 },
      ],
      sqlEstado: SqlEstado.PendienteAsignacion,
      existing: null,
    });

    await ctx.service.assign(
      SQL_ID,
      { comercial_asignado_id: COMERCIAL_ID, cita: citaDto },
      SOPORTE_ID,
      'SoporteComercial',
    );

    expect(ctx.order).toEqual(['create-cita', 'insert-snapshot', 'graph']);
    expect(ctx.wasCommitted()).toBe(true);
  });

  it('REQ-01: a directory failure aborts the schedule', async () => {
    const ctx = build({
      defaults: [
        { email: 'erobles@grupoverytel.com', name: null, sortOrder: 1 },
      ],
      existing: null,
      findByEmailError: true,
    });

    await expect(
      ctx.service.createCitaForAssignedSql(
        SQL_ID,
        citaDto,
        SOPORTE_ID,
        'SoporteComercial',
      ),
    ).rejects.toThrow('directory down');
    expect(ctx.wasCommitted()).toBe(false);
  });
});
