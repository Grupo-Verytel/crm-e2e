import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Op, Sequelize, UniqueConstraintError } from 'sequelize';
import { AppAbility } from '../../auth/casl/casl-ability.factory';
import { AUTH_ERROR_CODES } from '../../auth/constants/auth.constants';
import {
  fiscalQuarterDayCount,
  MARKETING_GOAL_METRICS,
  type MarketingGoalMetric,
  bogotaDaysInRange,
} from '../lib/weekly-goal-attainment';
import { verytelQuarterOf } from '../../../common/time/verytel-quarter';
import type { VerytelQuarter } from '../../../common/time/verytel-quarter';
import {
  FISCAL_YEAR_MESSAGE,
  METRIC_MESSAGE,
  QUARTER_MESSAGE,
  WEEKLY_TARGET_MESSAGE,
  type DeleteMarketingDashboardGoalResponseDto,
  type ListMarketingDashboardGoalsResponseDto,
  type MarketingDashboardTargetResponseDto,
  type ReplaceMarketingDashboardGoalsDto,
  type ReplaceMarketingDashboardGoalsResponseDto,
} from '../dtos/marketing-dashboard-goals.dto';
import { MarketingDashboardMetric } from '../models/enums/marketing-dashboard-metric.enum';
import { MarketingDashboardTarget } from '../models/marketing-dashboard-target.model';

const NOT_FOUND = 'No se encontró la meta.';
const FORBIDDEN = {
  code: AUTH_ERROR_CODES.FORBIDDEN,
  message: 'Insufficient permissions',
};
const METRIC_ORDER = MARKETING_GOAL_METRICS;
const METRIC_LABEL: Record<MarketingGoalMetric, string> = {
  INTERACTIONS: 'Interacciones',
  LEADS: 'Leads',
  CONVERTED_OUV: 'Convertidos a OUV',
};

export type ReplaceMarketingGoalsResult = {
  statusCode: 200 | 201;
  body: ReplaceMarketingDashboardGoalsResponseDto;
};

type QuarterKey = { fiscalYear: number; quarter: VerytelQuarter };

@Injectable()
export class MarketingDashboardTargetsService {
  constructor(
    @InjectModel(MarketingDashboardTarget)
    private readonly targetModel: typeof MarketingDashboardTarget,
    @InjectConnection() private readonly sequelize: Sequelize,
  ) {}

  async list(year: number): Promise<ListMarketingDashboardGoalsResponseDto> {
    this.assertYear(year);
    const rows = await this.targetModel.findAll({
      where: { fiscalYear: year },
      order: [
        ['quarter', 'ASC'],
        ['metric', 'ASC'],
      ],
    });
    return {
      fiscal_year: year,
      quarters: ([1, 2, 3, 4] as const).map((quarter) => ({
        quarter,
        days: fiscalQuarterDayCount(year, quarter),
      })),
      items: this.ordered(rows).map((row) => this.present(row)),
    };
  }

  async replaceQuarter(
    dto: ReplaceMarketingDashboardGoalsDto,
    ability: AppAbility | undefined,
  ): Promise<ReplaceMarketingGoalsResult> {
    this.assertBatch(dto);
    if (!ability) {
      throw new ForbiddenException(FORBIDDEN);
    }

    try {
      return await this.sequelize.transaction(async (transaction) => {
        const existing = await this.targetModel.findAll({
          where: { fiscalYear: dto.fiscal_year, quarter: dto.quarter },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        const byMetric = new Map(existing.map((row) => [row.metric, row]));
        const creates = dto.goals.filter((goal) => !byMetric.has(goal.metric));
        const updates = dto.goals.filter((goal) => byMetric.has(goal.metric));
        if (
          (creates.length > 0 && !ability.can('create', 'DemandGoal')) ||
          (updates.length > 0 && !ability.can('update', 'DemandGoal'))
        ) {
          throw new ForbiddenException(FORBIDDEN);
        }

        let created = false;
        for (const goal of dto.goals) {
          const current = byMetric.get(goal.metric);
          if (!current) {
            await this.targetModel.create(
              {
                fiscalYear: dto.fiscal_year,
                quarter: dto.quarter,
                metric: goal.metric,
                weeklyTarget: goal.weekly_target,
              },
              { transaction },
            );
            created = true;
            continue;
          }
          if (current.weeklyTarget !== goal.weekly_target) {
            await current.update(
              { weeklyTarget: goal.weekly_target },
              { transaction },
            );
          }
        }

        const saved = await this.targetModel.findAll({
          where: { fiscalYear: dto.fiscal_year, quarter: dto.quarter },
          transaction,
        });
        return {
          statusCode: created ? 201 : 200,
          body: {
            fiscal_year: dto.fiscal_year,
            quarter: dto.quarter,
            items: this.ordered(saved).map((row) => this.present(row)),
          },
        };
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        await this.throwConflict(dto);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<DeleteMarketingDashboardGoalResponseDto> {
    const row = await this.targetModel.findByPk(id);
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: NOT_FOUND });
    }
    await row.destroy();
    return { deleted: true };
  }

  async findLiveCovering(
    start: Date,
    end: Date,
  ): Promise<
    Array<{
      fiscalYear: number;
      quarter: number;
      metric: string;
      weeklyTarget: number;
    }>
  > {
    const keys = this.quarterKeys(start, end);
    if (keys.length === 0) {
      return [];
    }
    const rows = await this.targetModel.findAll({
      where: {
        [Op.or]: keys.map((key) => ({
          fiscalYear: key.fiscalYear,
          quarter: key.quarter,
        })),
      },
    });
    return rows.map((row) => ({
      fiscalYear: row.fiscalYear,
      quarter: row.quarter,
      metric: row.metric,
      weeklyTarget: row.weeklyTarget,
    }));
  }

  private quarterKeys(start: Date, end: Date): QuarterKey[] {
    const seen = new Map<string, QuarterKey>();
    for (const day of bogotaDaysInRange(start, end)) {
      const point = verytelQuarterOf(day);
      seen.set(`${point.fiscalYear}:${point.quarter}`, point);
    }
    return [...seen.values()];
  }

  private assertYear(year: number): void {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException({
        code: 'VALIDATION',
        message: FISCAL_YEAR_MESSAGE,
      });
    }
  }

  private assertBatch(dto: ReplaceMarketingDashboardGoalsDto): void {
    this.assertYear(dto.fiscal_year);
    if (!Number.isInteger(dto.quarter) || dto.quarter < 1 || dto.quarter > 4) {
      throw new BadRequestException({
        code: 'VALIDATION',
        message: QUARTER_MESSAGE,
      });
    }
    if (!Array.isArray(dto.goals) || dto.goals.length !== 3) {
      throw new BadRequestException({
        code: 'VALIDATION',
        message: METRIC_MESSAGE,
      });
    }
    const metrics = new Set<string>(METRIC_ORDER);
    const seen = new Set<string>();
    for (const goal of dto.goals) {
      if (!metrics.has(goal.metric) || seen.has(goal.metric)) {
        throw new BadRequestException({
          code: 'VALIDATION',
          message: METRIC_MESSAGE,
        });
      }
      seen.add(goal.metric);
      if (
        !Number.isInteger(goal.weekly_target) ||
        goal.weekly_target < 0 ||
        goal.weekly_target > 2147483647
      ) {
        throw new BadRequestException({
          code: 'VALIDATION',
          message: WEEKLY_TARGET_MESSAGE,
        });
      }
    }
  }

  private async throwConflict(
    dto: ReplaceMarketingDashboardGoalsDto,
  ): Promise<never> {
    const winner = await this.targetModel.findOne({
      where: { fiscalYear: dto.fiscal_year, quarter: dto.quarter },
      order: [['metric', 'ASC']],
    });
    const metric = (winner?.metric ??
      MarketingDashboardMetric.Interactions) as MarketingGoalMetric;
    throw new ConflictException({
      code: 'CONFLICT',
      message: `Ya existe una meta semanal de ${METRIC_LABEL[metric]} para Q${dto.quarter} ${dto.fiscal_year}.`,
      existing_goal_id: winner?.targetId ?? null,
    });
  }

  private ordered(
    rows: MarketingDashboardTarget[],
  ): MarketingDashboardTarget[] {
    return [...rows].sort((left, right) => {
      if (left.quarter !== right.quarter) {
        return left.quarter - right.quarter;
      }
      return (
        METRIC_ORDER.indexOf(left.metric) - METRIC_ORDER.indexOf(right.metric)
      );
    });
  }

  private present(
    row: MarketingDashboardTarget,
  ): MarketingDashboardTargetResponseDto {
    return {
      target_id: row.targetId,
      fiscal_year: row.fiscalYear,
      quarter: row.quarter,
      metric: row.metric,
      weekly_target: row.weeklyTarget,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }
}
