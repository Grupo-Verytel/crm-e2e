import { Sequelize } from 'sequelize-typescript';
import { AuditContextService } from '../../audit/context/audit-context.service';
import { AuditAction } from '../../audit/models/audit-action.enum';
import { AuditLog } from '../../audit/models/audit-log.model';
import { AuditHooksService } from '../../audit/services/audit-hooks.service';
import { AuditWriterService } from '../../audit/services/audit-writer.service';
import { MarketingDashboardMetric } from './enums/marketing-dashboard-metric.enum';
import { MarketingDashboardTarget } from './marketing-dashboard-target.model';

const ACTOR = '99999999-9999-4999-8999-999999999999';
const GOAL_ID = '55555555-5555-4555-8555-555555555555';

describe('MarketingDashboardTarget audit hooks', () => {
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
      sequelize.addModels([MarketingDashboardTarget]);
    } catch (error) {
      if (!MarketingDashboardTarget.isInitialized) {
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

  function build(weeklyTarget = 10): MarketingDashboardTarget {
    return MarketingDashboardTarget.build({
      targetId: GOAL_ID,
      fiscalYear: 2026,
      quarter: 2,
      metric: MarketingDashboardMetric.Interactions,
      weeklyTarget,
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
    goal: MarketingDashboardTarget,
  ): Promise<void> {
    const runner = MarketingDashboardTarget as unknown as {
      runHooks: (
        hookName: string,
        instance: MarketingDashboardTarget,
      ) => Promise<void>;
    };
    await runner.runHooks(name, goal);
  }

  it('REQ-12: create writes one INSERT with the actor', async () => {
    stored.length = 0;
    const goal = build();
    await asActor(() => runHook('afterCreate', goal));
    expect(stored.at(-1)).toMatchObject({
      tabla: 'marketing_dashboard_targets',
      registroId: GOAL_ID,
      accion: AuditAction.INSERT,
      usuarioId: ACTOR,
      valorAnterior: null,
    });
  });

  it('REQ-12: update writes the previous and next weekly target', async () => {
    stored.length = 0;
    const goal = build(10);
    goal.set('weeklyTarget', 12);
    await asActor(() => runHook('afterUpdate', goal));
    const update = stored.find(
      (row) => row.campoModificado === 'weekly_target',
    );
    expect(update).toMatchObject({
      tabla: 'marketing_dashboard_targets',
      registroId: GOAL_ID,
      accion: AuditAction.UPDATE,
      usuarioId: ACTOR,
      campoModificado: 'weekly_target',
      valorAnterior: '10',
      valorNuevo: '12',
    });
  });

  it('REQ-12: an unchanged model does not write UPDATE', async () => {
    stored.length = 0;
    const goal = build(10);
    for (const field of goal.changed() || []) {
      goal.changed(field, false);
    }
    await asActor(() => runHook('afterUpdate', goal));
    expect(stored).toHaveLength(0);
  });

  it('REQ-12: delete writes DELETE', async () => {
    stored.length = 0;
    const goal = build();
    await asActor(() => runHook('afterDestroy', goal));
    expect(stored.at(-1)).toMatchObject({
      tabla: 'marketing_dashboard_targets',
      registroId: GOAL_ID,
      accion: AuditAction.DELETE,
      usuarioId: ACTOR,
      valorNuevo: null,
    });
  });
});
