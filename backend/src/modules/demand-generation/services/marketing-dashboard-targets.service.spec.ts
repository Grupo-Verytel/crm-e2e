import { createRequire } from 'node:module';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UniqueConstraintError } from 'sequelize';
import { CaslAbilityFactory } from '../../auth/casl/casl-ability.factory';
import type { AppAbility } from '../../auth/casl/casl-ability.factory';
import { MarketingDashboardMetric } from '../models/enums/marketing-dashboard-metric.enum';
import { MarketingDashboardTargetsService } from './marketing-dashboard-targets.service';

const nodeRequire = createRequire(__filename);
const { buildPermissions } = nodeRequire(
  '../../../../database/seeders/lib/role-permissions',
) as {
  buildPermissions: (roleName: string) => Array<{
    action: string;
    subject: string;
  }>;
};

const factory = new CaslAbilityFactory();

function abilityFor(roleName: string): AppAbility {
  return factory.createForPermissions(buildPermissions(roleName));
}

function abilityFrom(actions: string[]): AppAbility {
  return factory.createForPermissions(
    actions.map((action) => ({ action, subject: 'DemandGoal' })),
  );
}

const METRICS = [
  MarketingDashboardMetric.Interactions,
  MarketingDashboardMetric.Leads,
  MarketingDashboardMetric.ConvertedOuv,
] as const;

function batch(
  weekly: [number, number, number],
  fiscalYear = 2026,
  quarter = 2,
) {
  return {
    fiscal_year: fiscalYear,
    quarter,
    goals: METRICS.map((metric, index) => ({
      metric,
      weekly_target: weekly[index],
    })),
  };
}

type Stored = {
  targetId: string;
  fiscalYear: number;
  quarter: number;
  metric: MarketingDashboardMetric;
  weeklyTarget: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  update: (patch: { weeklyTarget: number }) => Promise<Stored>;
  destroy: () => Promise<void>;
};

function buildHarness() {
  const rows: Stored[] = [];
  let sequence = 0;
  let transactionCalls = 0;
  let failCreateOn: MarketingDashboardMetric | null = null;
  const externalWinner: Stored[] = [];
  const updates: string[] = [];

  function visible(row: Stored): boolean {
    return row.deletedAt == null;
  }

  function hydrate(values: Omit<Stored, 'update' | 'destroy'>): Stored {
    const row = values as Stored;
    row.update = (patch) => {
      updates.push(row.targetId);
      row.weeklyTarget = patch.weeklyTarget;
      row.updatedAt = new Date('2026-10-29T18:00:00.000Z');
      return Promise.resolve(row);
    };
    row.destroy = () => {
      row.deletedAt = new Date('2026-10-29T19:00:00.000Z');
      return Promise.resolve();
    };
    return row;
  }

  function snapshot(): Array<Omit<Stored, 'update' | 'destroy'>> {
    return rows.map((row) => ({
      targetId: row.targetId,
      fiscalYear: row.fiscalYear,
      quarter: row.quarter,
      metric: row.metric,
      weeklyTarget: row.weeklyTarget,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    }));
  }

  function restore(saved: Array<Omit<Stored, 'update' | 'destroy'>>): void {
    rows.splice(0, rows.length, ...saved.map((item) => hydrate(item)));
  }

  const targetModel = {
    findAll: jest.fn(
      (options: { where?: { fiscalYear?: number; quarter?: number } }) => {
        return rows.filter((row) => {
          if (!visible(row)) {
            return false;
          }
          if (
            options.where?.fiscalYear != null &&
            row.fiscalYear !== options.where.fiscalYear
          ) {
            return false;
          }
          if (
            options.where?.quarter != null &&
            row.quarter !== options.where.quarter
          ) {
            return false;
          }
          return true;
        });
      },
    ),
    findByPk: jest.fn((id: string) => {
      return rows.find((row) => row.targetId === id && visible(row)) ?? null;
    }),
    findOne: jest.fn(() => {
      return (
        externalWinner.find((row) => visible(row)) ??
        rows.find((row) => visible(row)) ??
        null
      );
    }),
    create: jest.fn(
      (values: {
        fiscalYear: number;
        quarter: number;
        metric: MarketingDashboardMetric;
        weeklyTarget: number;
      }) => {
        if (failCreateOn === values.metric) {
          throw new UniqueConstraintError({ message: 'duplicate' });
        }
        const row = hydrate({
          targetId: `goal-${++sequence}`,
          fiscalYear: values.fiscalYear,
          quarter: values.quarter,
          metric: values.metric,
          weeklyTarget: values.weeklyTarget,
          createdAt: new Date('2026-10-29T17:00:00.000Z'),
          updatedAt: new Date('2026-10-29T17:00:00.000Z'),
          deletedAt: null,
        });
        rows.push(row);
        return row;
      },
    ),
  };

  const sequelize = {
    transaction: jest.fn(
      async (
        work: (transaction: { LOCK: { UPDATE: string } }) => Promise<unknown>,
      ) => {
        transactionCalls += 1;
        const saved = snapshot();
        try {
          return await work({ LOCK: { UPDATE: 'UPDATE' } });
        } catch (error) {
          restore(saved);
          throw error;
        }
      },
    ),
  };

  const service = new MarketingDashboardTargetsService(
    targetModel as never,
    sequelize as never,
  );

  return {
    service,
    rows,
    updates,
    externalWinner,
    sequelize,
    targetModel,
    setFailCreateOn(metric: MarketingDashboardMetric | null) {
      failCreateOn = metric;
    },
    transactionCalls: () => transactionCalls,
  };
}

describe('MarketingDashboardTargetsService', () => {
  it('REQ-04: GestorMercadeo receives 403 and nothing is stored', async () => {
    const harness = buildHarness();
    await expect(
      harness.service.replaceQuarter(
        batch([10, 3, 0]),
        abilityFor('GestorMercadeo'),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(harness.rows).toHaveLength(0);
    expect(harness.transactionCalls()).toBe(1);
  });

  it('REQ-04: update-only cannot create a new quarter', async () => {
    const harness = buildHarness();
    await expect(
      harness.service.replaceQuarter(
        batch([10, 3, 1]),
        abilityFrom(['update']),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(harness.rows).toHaveLength(0);
    expect(harness.targetModel.create).not.toHaveBeenCalled();
  });

  it('REQ-01: a new quarter stores the three metrics, including zero', async () => {
    const harness = buildHarness();
    const result = await harness.service.replaceQuarter(
      batch([10, 3, 0]),
      abilityFor('DirectorMercadeo'),
    );
    expect(result.statusCode).toBe(201);
    expect(result.body.items.map((item) => item.weekly_target)).toEqual([
      10, 3, 0,
    ]);
    expect(result.body.items.map((item) => item.metric)).toEqual([...METRICS]);
    expect(harness.rows).toHaveLength(3);
  });

  it('REQ-02: a second put updates the same ids', async () => {
    const harness = buildHarness();
    const created = await harness.service.replaceQuarter(
      batch([10, 3, 0]),
      abilityFor('Admin'),
    );
    harness.updates.length = 0;
    const updated = await harness.service.replaceQuarter(
      batch([12, 3, 0]),
      abilityFor('Admin'),
    );
    expect(updated.statusCode).toBe(200);
    expect(updated.body.items.map((item) => item.target_id)).toEqual(
      created.body.items.map((item) => item.target_id),
    );
    expect(updated.body.items[0].weekly_target).toBe(12);
    expect(harness.updates).toEqual([created.body.items[0].target_id]);
  });

  it('REQ-04: create-only cannot edit live rows', async () => {
    const harness = buildHarness();
    await harness.service.replaceQuarter(
      batch([10, 3, 0]),
      abilityFor('DirectorMercadeo'),
    );
    await expect(
      harness.service.replaceQuarter(
        batch([12, 4, 1]),
        abilityFrom(['create']),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(harness.rows.map((row) => row.weeklyTarget)).toEqual([10, 3, 0]);
  });

  it('REQ-03: a partially invalid batch stores nothing', async () => {
    const harness = buildHarness();
    const dto = batch([10, 3, 0]);
    dto.goals[2].weekly_target = -1;
    await expect(
      harness.service.replaceQuarter(dto, abilityFor('DirectorMercadeo')),
    ).rejects.toMatchObject({
      response: {
        code: 'VALIDATION',
        message: 'La meta semanal debe ser un entero entre 0 y 2147483647.',
      },
    });
    expect(harness.transactionCalls()).toBe(0);
    expect(harness.rows).toHaveLength(0);
  });

  it('REQ-03: a repeated metric stores nothing', async () => {
    const harness = buildHarness();
    const dto = batch([10, 3, 0]);
    dto.goals[1].metric = MarketingDashboardMetric.Interactions;
    await expect(
      harness.service.replaceQuarter(dto, abilityFor('Admin')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(harness.rows).toHaveLength(0);
  });

  it('REQ-02: a unique collision rolls the batch back', async () => {
    const harness = buildHarness();
    harness.setFailCreateOn(MarketingDashboardMetric.Leads);
    harness.externalWinner.push({
      targetId: 'winner-leads',
      fiscalYear: 2026,
      quarter: 2,
      metric: MarketingDashboardMetric.Leads,
      weeklyTarget: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      update: () => Promise.resolve(harness.externalWinner[0]),
      destroy: () => Promise.resolve(),
    });
    await expect(
      harness.service.replaceQuarter(batch([10, 3, 0]), abilityFor('Admin')),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(harness.rows).toHaveLength(0);
  });

  it('REQ-05: delete is logical and the metric can be created again', async () => {
    const harness = buildHarness();
    const created = await harness.service.replaceQuarter(
      batch([10, 3, 1]),
      abilityFor('DirectorMercadeo'),
    );
    const leadsId = created.body.items[1].target_id;
    await expect(harness.service.remove(leadsId)).resolves.toEqual({
      deleted: true,
    });
    const listed = await harness.service.list(2026);
    expect(listed.items.map((item) => item.target_id)).not.toContain(leadsId);
    expect(listed.items).toHaveLength(2);
    await expect(harness.service.remove(leadsId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const again = await harness.service.replaceQuarter(
      batch([10, 4, 1]),
      abilityFor('DirectorMercadeo'),
    );
    expect(again.statusCode).toBe(201);
    expect(again.body.items[1].weekly_target).toBe(4);
    expect(again.body.items[1].target_id).not.toBe(leadsId);
    expect(again.body.items[0].target_id).toBe(created.body.items[0].target_id);
  });
});
