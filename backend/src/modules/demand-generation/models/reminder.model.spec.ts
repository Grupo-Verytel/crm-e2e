import { Sequelize } from 'sequelize-typescript';
import { AuditHooksService } from '../../audit/services/audit-hooks.service';
import { AuditAction } from '../../audit/models/audit-action.enum';
import { OuvInteraction } from '../../discovery/models/ouv-interaction.model';
import { OutlookSyncStatus } from './enums/outlook-sync-status.enum';
import { ReminderStatus } from './enums/reminder-status.enum';
import {
  assertSingleReminderSource,
  Reminder,
} from './reminder.model';

const INTERACTION_ID = '11111111-1111-4111-8111-111111111111';
const OUV_INTERACTION_ID = '22222222-2222-4222-8222-222222222222';

describe('assertSingleReminderSource', () => {
  it('REQ-02: rejects a reminder with both sources', () => {
    expect(() =>
      assertSingleReminderSource(INTERACTION_ID, OUV_INTERACTION_ID),
    ).toThrow(/exactly one source/);
  });

  it('REQ-02: rejects a reminder with neither source', () => {
    expect(() => assertSingleReminderSource(null, null)).toThrow(
      /exactly one source/,
    );
    expect(() => assertSingleReminderSource(undefined, '')).toThrow(
      /exactly one source/,
    );
  });

  it('REQ-01: accepts a lead interaction as the only source', () => {
    expect(() =>
      assertSingleReminderSource(INTERACTION_ID, null),
    ).not.toThrow();
  });

  it('REQ-01: accepts an OUV interaction as the only source', () => {
    expect(() =>
      assertSingleReminderSource(null, OUV_INTERACTION_ID),
    ).not.toThrow();
  });
});

describe('Reminder model validator', () => {
  const write = jest.fn().mockResolvedValue(undefined);
  const sequelize = new Sequelize({
    dialect: 'mysql',
    host: '127.0.0.1',
    username: 'unused',
    password: 'unused',
    database: 'unused',
    logging: false,
  });

  beforeAll(() => {
    try {
      sequelize.addModels([OuvInteraction, Reminder]);
    } catch (error) {
      // Associations point at models this unit test does not register.
      // The class is still initialized, which is all validate() needs.
      if (!Reminder.isInitialized) {
        throw error;
      }
    }
    const hooks = new AuditHooksService(
      sequelize as never,
      { write } as never,
    );
    hooks.onModuleInit();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  function build(source: {
    interactionId?: string | null;
    ouvInteractionId?: string | null;
  }): Reminder {
    return Reminder.build({
      reminderId: '33333333-3333-4333-8333-333333333333',
      userId: '44444444-4444-4444-8444-444444444444',
      interactionId: source.interactionId ?? null,
      ouvInteractionId: source.ouvInteractionId ?? null,
      eventAt: new Date('2026-10-20T15:00:00.000Z'),
      remindDaysBefore: 1,
      remindAt: new Date('2026-10-19T15:00:00.000Z'),
      status: ReminderStatus.Pendiente,
      outlookSyncStatus: OutlookSyncStatus.NotRequired,
      outlookSyncAttempts: 0,
    });
  }

  it('REQ-02: model validate rejects both sources before a write', async () => {
    await expect(
      build({
        interactionId: INTERACTION_ID,
        ouvInteractionId: OUV_INTERACTION_ID,
      }).validate(),
    ).rejects.toThrow(/exactly one source/);
  });

  it('REQ-02: model validate rejects no source before a write', async () => {
    await expect(
      build({ interactionId: null, ouvInteractionId: null }).validate(),
    ).rejects.toThrow(/exactly one source/);
  });

  it('REQ-01: model validate accepts a single lead source', async () => {
    await expect(
      build({ interactionId: INTERACTION_ID, ouvInteractionId: null }).validate(),
    ).resolves.toMatchObject({ interactionId: INTERACTION_ID });
  });

  it('AJ2: deferred require resolves HasMany to the Reminder class', () => {
    const meta = Reflect.getMetadata(
      'sequelize:associations',
      OuvInteraction.prototype,
    ) as Array<{ getAssociatedClass: () => { name?: string } }> | undefined;
    const resolved = (meta ?? []).map((item) => item.getAssociatedClass());
    expect(resolved).toContain(Reminder);
  });

  it('afterCreate writes an audit_log INSERT through AuditHooksService', async () => {
    write.mockClear();
    const reminder = build({
      interactionId: null,
      ouvInteractionId: OUV_INTERACTION_ID,
    });

    await Reminder.runHooks('afterCreate', reminder);

    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        tabla: 'reminders',
        registroId: reminder.reminderId,
        accion: AuditAction.INSERT,
        valorAnterior: null,
      }),
    );
  });

  it('afterUpdate writes one audit_log row per changed field', async () => {
    write.mockClear();
    const reminder = build({
      interactionId: null,
      ouvInteractionId: OUV_INTERACTION_ID,
    });
    reminder.set('completedAt', new Date('2026-10-17T12:00:00.000Z'));
    reminder.set('status', ReminderStatus.Cancelado);

    await Reminder.runHooks('afterUpdate', reminder);

    const fields = write.mock.calls.map(
      (call) => (call[0] as { campoModificado: string }).campoModificado,
    );
    expect(fields).toEqual(expect.arrayContaining(['completed_at', 'status']));
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        tabla: 'reminders',
        accion: AuditAction.UPDATE,
        campoModificado: 'completed_at',
      }),
    );
  });

  it('REQ-01: model validate accepts a single OUV source', async () => {
    await expect(
      build({
        interactionId: null,
        ouvInteractionId: OUV_INTERACTION_ID,
      }).validate(),
    ).resolves.toMatchObject({ ouvInteractionId: OUV_INTERACTION_ID });
  });
});
