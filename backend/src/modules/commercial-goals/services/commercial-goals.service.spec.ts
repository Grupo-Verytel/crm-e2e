import { createRequire } from 'node:module';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UniqueConstraintError } from 'sequelize';
import { User } from '../../auth/models/user.model';
import { CreateCommercialGoalDto } from '../dtos/commercial-goal.dto';
import { CommercialGoalsService } from './commercial-goals.service';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const SEGMENT = '33333333-3333-4333-8333-333333333333';
const SEGMENT_B = '44444444-4444-4444-8444-444444444444';

const nodeRequire = createRequire(__filename);
const { buildPermissions } = nodeRequire(
  '../../../../database/seeders/lib/role-permissions',
) as {
  buildPermissions: (roleName: string) => Array<{
    action: string;
    subject: string;
  }>;
};

type StoredGoal = {
  commercialGoalId: string;
  userId: string;
  fiscalYear: number;
  quarter: number;
  segmentId: string;
  amountCop: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  commercial: { fullName: string; role: { name: string } };
  update: (patch: Record<string, unknown>) => Promise<StoredGoal>;
  destroy: () => Promise<void>;
};

function buildHarness() {
  const rows = new Map<string, StoredGoal>();
  let sequence = 0;
  const usersService = {
    isActiveWithAnyRole: jest.fn().mockResolvedValue(true),
  };
  const demandGenerationService = {
    listSegments: jest.fn().mockResolvedValue([
      { id: SEGMENT, name: 'Industria', subsegments: [] },
      { id: SEGMENT_B, name: 'Otros', subsegments: [] },
    ]),
    findSegmentNamesByIds: jest.fn((ids: string[]) => {
      const names = new Map<string, string>([
        [SEGMENT, 'Industria'],
        [SEGMENT_B, 'Otros'],
      ]);
      const found = new Map<string, string>();
      for (const id of ids) {
        const name = names.get(id);
        if (name) {
          found.set(id, name);
        }
      }
      return found;
    }),
  };

  function make(
    values: Partial<StoredGoal> & Pick<StoredGoal, 'userId'>,
  ): StoredGoal {
    const row = {
      commercialGoalId: values.commercialGoalId ?? `goal-${++sequence}`,
      userId: values.userId,
      fiscalYear: values.fiscalYear ?? 2026,
      quarter: values.quarter ?? 4,
      segmentId: values.segmentId ?? SEGMENT,
      amountCop: values.amountCop ?? '1000',
      createdAt: values.createdAt ?? new Date('2026-10-20T15:00:00.000Z'),
      updatedAt: values.updatedAt ?? new Date('2026-10-20T15:00:00.000Z'),
      deletedAt: values.deletedAt ?? null,
      commercial: values.commercial ?? {
        fullName: values.userId === OTHER ? 'Greta' : 'Ada',
        role: {
          name:
            values.userId === OTHER
              ? 'Gerente Comercial'
              : 'EjecutivoComercial',
        },
      },
      update: jest.fn((patch: Record<string, unknown>) => {
        Object.assign(row, patch, {
          updatedAt: new Date('2026-10-21T15:00:00.000Z'),
        });
        return row;
      }),
      destroy: jest.fn(() => {
        row.deletedAt = new Date('2026-10-21T16:00:00.000Z');
      }),
    } as StoredGoal;
    rows.set(row.commercialGoalId, row);
    return row;
  }

  const goalModel = {
    findAndCountAll: jest.fn(() => {
      const alive = [...rows.values()].filter((row) => row.deletedAt === null);
      return { rows: alive, count: alive.length };
    }),
    findAll: jest.fn(),
    findByPk: jest.fn((id: string) => {
      const row = rows.get(id);
      if (!row || row.deletedAt) return null;
      return row;
    }),
    findOne: jest.fn((options: { where: StoredGoal }) => {
      const where = options.where;
      return (
        [...rows.values()].find(
          (row) =>
            row.deletedAt === null &&
            row.userId === where.userId &&
            row.fiscalYear === where.fiscalYear &&
            row.quarter === where.quarter &&
            row.segmentId === where.segmentId,
        ) ?? null
      );
    }),
    create: jest.fn((values: StoredGoal) => make(values)),
  };

  const service = new CommercialGoalsService(
    goalModel as never,
    usersService as never,
    demandGenerationService as never,
  );

  return {
    service,
    usersService,
    demandGenerationService,
    goalModel,
    rows,
    make,
  };
}

const validBody = {
  user_id: USER,
  fiscal_year: 2026,
  quarter: 4,
  segment_id: SEGMENT,
  amount_cop: 1200000000,
};

async function dtoErrors(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateCommercialGoalDto, payload);
  return validate(dto);
}

describe('CommercialGoalsService', () => {
  it('REQ-01: creates a goal and returns the stored fields', async () => {
    const { service } = buildHarness();
    const created = await service.create(validBody);
    expect(created.user_id).toBe(USER);
    expect(created.fiscal_year).toBe(2026);
    expect(created.quarter).toBe(4);
    expect(created.segment_name).toBe('Industria');
    expect(created.amount_cop).toBe('1200000000');
    expect(created.commercial_full_name).toBe('Ada');
    expect(created.commercial_role_name).toBe('EjecutivoComercial');
  });

  it('REQ-02: rejects a duplicate active combination with 409 and the existing id', async () => {
    const { service, make } = buildHarness();
    const existing = make({
      userId: USER,
      fiscalYear: 2026,
      quarter: 4,
      segmentId: SEGMENT,
    });
    const error = await service
      .create(validBody)
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ConflictException);
    const body = (error as ConflictException).getResponse() as {
      code: string;
      message: string;
      existing_goal_id: string;
    };
    expect(body.code).toBe('CONFLICT');
    expect(body.message).toBe(
      'Ya existe una meta para este comercial en Q4 2026 · Industria.',
    );
    expect(body.existing_goal_id).toBe(existing.commercialGoalId);
  });

  it('REQ-02: a race on the unique index still returns 409', async () => {
    const { service, goalModel, make } = buildHarness();
    const existing = make({
      userId: USER,
      fiscalYear: 2026,
      quarter: 1,
      segmentId: SEGMENT,
    });
    goalModel.findOne.mockResolvedValueOnce(null);
    goalModel.create.mockRejectedValueOnce(new UniqueConstraintError({}));
    await expect(
      service.create({ ...validBody, quarter: 1 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(existing.commercialGoalId).toBeTruthy();
  });

  it('REQ-09: a soft-deleted goal does not block the same combination', async () => {
    const { service } = buildHarness();
    const created = await service.create(validBody);
    await service.remove(created.commercial_goal_id);
    await expect(
      service.getById(created.commercial_goal_id),
    ).rejects.toBeInstanceOf(NotFoundException);
    const again = await service.create(validBody);
    expect(again.commercial_goal_id).not.toBe(created.commercial_goal_id);
    expect(again.amount_cop).toBe('1200000000');
  });

  it('REQ-03: rejects an inactive commercial or one outside the assignable roles', async () => {
    const { service, usersService } = buildHarness();
    usersService.isActiveWithAnyRole.mockResolvedValue(false);
    const error = await service
      .create(validBody)
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      code: 'VALIDATION',
      message:
        'El comercial debe ser un Ejecutivo Comercial o Gerente Comercial activo.',
    });
  });

  it('REQ-04: rejects a segment that is not in the active catalog', async () => {
    const { service, demandGenerationService } = buildHarness();
    demandGenerationService.listSegments.mockResolvedValue([]);
    await expect(service.create(validBody)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('REQ-04: DTO rejects 0, negative, decimal, quarter and year out of range', async () => {
    expect(await dtoErrors({ ...validBody, amount_cop: 0 })).not.toHaveLength(
      0,
    );
    expect(await dtoErrors({ ...validBody, amount_cop: -5 })).not.toHaveLength(
      0,
    );
    expect(await dtoErrors({ ...validBody, amount_cop: 1.5 })).not.toHaveLength(
      0,
    );
    expect(await dtoErrors({ ...validBody, quarter: 0 })).not.toHaveLength(0);
    expect(await dtoErrors({ ...validBody, quarter: 5 })).not.toHaveLength(0);
    expect(
      await dtoErrors({ ...validBody, fiscal_year: 2019 }),
    ).not.toHaveLength(0);
    expect(
      await dtoErrors({ ...validBody, fiscal_year: 2101 }),
    ).not.toHaveLength(0);
    expect(await dtoErrors(validBody)).toHaveLength(0);
  });

  it('REQ-08 path: update writes the new amount through the model instance', async () => {
    const { service, make } = buildHarness();
    const row = make({ userId: USER, amountCop: '10' });
    const updated = await service.update(row.commercialGoalId, {
      amount_cop: 80,
    });
    expect(updated.amount_cop).toBe('80');
    expect(row.amountCop).toBe('80');
  });

  it('REQ-02: moving a goal onto another live combination returns 409', async () => {
    const { service, make } = buildHarness();
    const kept = make({ userId: USER, quarter: 4, segmentId: SEGMENT });
    const moving = make({ userId: OTHER, quarter: 3, segmentId: SEGMENT_B });
    await expect(
      service.update(moving.commercialGoalId, {
        user_id: USER,
        quarter: 4,
        segment_id: SEGMENT,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(kept.quarter).toBe(4);
  });

  it('REQ-10: list forwards filters, pagination and sort', async () => {
    const { service, goalModel } = buildHarness();
    goalModel.findAndCountAll.mockResolvedValueOnce({ rows: [], count: 0 });
    await service.list({
      page: 2,
      limit: 10,
      fiscal_year: 2026,
      quarter: 4,
      user_id: USER,
      segment_id: SEGMENT,
    });
    expect(goalModel.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          fiscalYear: 2026,
          quarter: 4,
          userId: USER,
          segmentId: SEGMENT,
        },
        limit: 10,
        offset: 10,
        order: [
          ['fiscalYear', 'DESC'],
          ['quarter', 'DESC'],
          [{ model: User, as: 'commercial' }, 'fullName', 'ASC'],
        ],
      }),
    );
  });

  it('summary fills the four quarters and keeps commercial and segment filters', async () => {
    const { service, goalModel } = buildHarness();
    goalModel.findAll.mockResolvedValue([
      { quarter: 4, total_amount_cop: '1500000000.000', commercial_count: '2' },
    ]);
    const summary = await service.summary({
      fiscal_year: 2026,
      user_id: USER,
      segment_id: SEGMENT,
    });
    expect(summary.quarters).toHaveLength(4);
    expect(summary.quarters[0]).toEqual({
      quarter: 1,
      total_amount_cop: '0',
      commercial_count: 0,
    });
    expect(summary.quarters[3]).toEqual({
      quarter: 4,
      total_amount_cop: '1500000000',
      commercial_count: 2,
    });
    expect(goalModel.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fiscalYear: 2026, userId: USER, segmentId: SEGMENT },
        group: ['quarter'],
      }),
    );
  });

  it('REQ-07 matrix: only SoporteComercial and Admin receive CommercialGoal', () => {
    for (const roleName of ['SoporteComercial', 'Admin']) {
      const rules = buildPermissions(roleName).filter(
        (rule) => rule.subject === 'CommercialGoal',
      );
      expect(rules.map((rule) => rule.action).sort()).toEqual([
        'create',
        'delete',
        'read',
        'update',
      ]);
    }
    for (const roleName of [
      'EjecutivoComercial',
      'Gerente Comercial',
      'Preventa',
    ]) {
      expect(
        buildPermissions(roleName).some(
          (rule) => rule.subject === 'CommercialGoal',
        ),
      ).toBe(false);
    }
  });
});
