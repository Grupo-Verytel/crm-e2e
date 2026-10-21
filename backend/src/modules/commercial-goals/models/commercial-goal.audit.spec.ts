import { Sequelize } from 'sequelize-typescript';
import { AuditContextService } from '../../audit/context/audit-context.service';
import { AuditAction } from '../../audit/models/audit-action.enum';
import { AuditLog } from '../../audit/models/audit-log.model';
import { AuditHooksService } from '../../audit/services/audit-hooks.service';
import { AuditWriterService } from '../../audit/services/audit-writer.service';
import { Role } from '../../auth/models/role.model';
import { User } from '../../auth/models/user.model';
import { CommercialGoal } from './commercial-goal.model';

const ACTOR = '99999999-9999-4999-8999-999999999999';
const GOAL_ID = '55555555-5555-4555-8555-555555555555';

describe('CommercialGoal audit hooks', () => {
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
      sequelize.addModels([Role, User, CommercialGoal]);
    } catch (error) {
      if (!CommercialGoal.isInitialized) {
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

  function build(): CommercialGoal {
    return CommercialGoal.build({
      commercialGoalId: GOAL_ID,
      userId: '11111111-1111-4111-8111-111111111111',
      fiscalYear: 2026,
      quarter: 4,
      segmentId: '33333333-3333-4333-8333-333333333333',
      amountCop: '1000',
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

  async function runHook(name: string, goal: CommercialGoal): Promise<void> {
    const runner = CommercialGoal as unknown as {
      runHooks: (hookName: string, instance: CommercialGoal) => Promise<void>;
    };
    await runner.runHooks(name, goal);
  }

  it('REQ-08: create writes INSERT with the actor', async () => {
    stored.length = 0;
    const goal = build();
    await asActor(() => runHook('afterCreate', goal));
    expect(stored.at(-1)).toMatchObject({
      tabla: 'commercial_goals',
      registroId: GOAL_ID,
      accion: AuditAction.INSERT,
      usuarioId: ACTOR,
      valorAnterior: null,
    });
  });

  it('REQ-08: update writes the previous and next value of the changed field', async () => {
    stored.length = 0;
    const goal = build();
    goal.set('amountCop', '2500');
    await asActor(() => runHook('afterUpdate', goal));
    const update = stored.find((row) => row.campoModificado === 'amount_cop');
    expect(update).toMatchObject({
      tabla: 'commercial_goals',
      accion: AuditAction.UPDATE,
      usuarioId: ACTOR,
      campoModificado: 'amount_cop',
    });
    expect(JSON.parse(String(update?.valorAnterior))).toBe('1000');
    expect(JSON.parse(String(update?.valorNuevo))).toBe('2500');
  });

  it('REQ-08: destroy writes DELETE with the actor', async () => {
    stored.length = 0;
    const goal = build();
    await asActor(() => runHook('afterDestroy', goal));
    expect(stored.at(-1)).toMatchObject({
      tabla: 'commercial_goals',
      registroId: GOAL_ID,
      accion: AuditAction.DELETE,
      usuarioId: ACTOR,
      valorNuevo: null,
    });
  });
});
