import { Sequelize } from 'sequelize-typescript';
import { AuditContextService } from '../../audit/context/audit-context.service';
import { AuditAction } from '../../audit/models/audit-action.enum';
import { AuditLog } from '../../audit/models/audit-log.model';
import { AuditHooksService } from '../../audit/services/audit-hooks.service';
import { AuditWriterService } from '../../audit/services/audit-writer.service';
import { DefaultMeetingAttendee } from './default-meeting-attendee.model';

const ACTOR = '99999999-9999-4999-8999-999999999999';
const ROW_ID = '55555555-5555-4555-8555-555555555555';

describe('DefaultMeetingAttendee audit hooks', () => {
  const stored: Array<Record<string, unknown>> = [];
  const sequelize = new Sequelize({
    dialect: 'mysql',
    host: '127.0.0.1',
    username: 'unused',
    password: 'unused',
    database: 'unused',
    logging: false,
  });
  const context = new AuditContextService();

  beforeAll(() => {
    jest.spyOn(AuditLog, 'create').mockImplementation((values: object) => {
      stored.push(values as Record<string, unknown>);
      return Promise.resolve(values as AuditLog);
    });
    try {
      sequelize.addModels([DefaultMeetingAttendee]);
    } catch (error) {
      if (!DefaultMeetingAttendee.isInitialized) {
        throw error;
      }
    }
    const writer = new AuditWriterService(context, {
      get: () => undefined,
    } as never);
    new AuditHooksService(sequelize, writer).onModuleInit();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await sequelize.close();
  });

  function build(): DefaultMeetingAttendee {
    return DefaultMeetingAttendee.build({
      defaultMeetingAttendeeId: ROW_ID,
      email: 'erobles@grupoverytel.com',
      name: null,
      sortOrder: 1,
      isActive: true,
    });
  }

  async function asActor(run: () => Promise<void>): Promise<void> {
    await context.run(
      { usuarioId: ACTOR, ipAddress: '127.0.0.1', userAgent: 'jest' },
      async () => {
        await run();
      },
    );
  }

  async function runHook(
    name: string,
    row: DefaultMeetingAttendee,
  ): Promise<void> {
    const runner = DefaultMeetingAttendee as unknown as {
      runHooks: (hookName: string, instance: DefaultMeetingAttendee) => Promise<void>;
    };
    await runner.runHooks(name, row);
  }

  it('REQ-14: create writes INSERT with the actor', async () => {
    stored.length = 0;
    await asActor(() => runHook('afterCreate', build()));
    expect(stored.at(-1)).toMatchObject({
      tabla: 'default_meeting_attendees',
      registroId: ROW_ID,
      accion: AuditAction.INSERT,
      usuarioId: ACTOR,
      valorAnterior: null,
    });
  });

  it('REQ-14: update writes the previous and next value', async () => {
    stored.length = 0;
    const row = build();
    row.set('name', 'Elena');
    await asActor(() => runHook('afterUpdate', row));
    const update = stored.find((entry) => entry.campoModificado === 'name');
    expect(update).toMatchObject({
      tabla: 'default_meeting_attendees',
      accion: AuditAction.UPDATE,
      usuarioId: ACTOR,
    });
    expect(JSON.parse(String(update?.valorAnterior))).toBeNull();
    expect(JSON.parse(String(update?.valorNuevo))).toBe('Elena');
  });

  it('REQ-14: destroy writes DELETE with the actor', async () => {
    stored.length = 0;
    await asActor(() => runHook('afterDestroy', build()));
    expect(stored.at(-1)).toMatchObject({
      tabla: 'default_meeting_attendees',
      registroId: ROW_ID,
      accion: AuditAction.DELETE,
      usuarioId: ACTOR,
      valorNuevo: null,
    });
  });
});
