import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { col, fn, UniqueConstraintError, WhereOptions } from 'sequelize';
import { ASSIGNABLE_COMMERCIAL_ROLE_NAMES } from '../../auth/constants/commercial-roles';
import { Role } from '../../auth/models/role.model';
import { User } from '../../auth/models/user.model';
import { UsersService } from '../../auth/services/users.service';
import { DemandGenerationService } from '../../demand-generation/services/demand-generation.service';
import {
  CommercialGoalResponseDto,
  CommercialGoalSummaryQueryDto,
  CommercialGoalSummaryResponseDto,
  CreateCommercialGoalDto,
  DeleteCommercialGoalResponseDto,
  ListCommercialGoalsQueryDto,
  PaginatedCommercialGoalsResponseDto,
  UpdateCommercialGoalDto,
} from '../dtos/commercial-goal.dto';
import { integerDigits } from '../lib/amount-cop';
import { CommercialGoal } from '../models/commercial-goal.model';

const COMMERCIAL_INCLUDE = {
  model: User,
  as: 'commercial' as const,
  attributes: ['userId', 'fullName'],
  required: false,
  include: [
    {
      model: Role,
      attributes: ['name'],
      required: false,
    },
  ],
};

const COMMERCIAL_INVALID =
  'El comercial debe ser un Ejecutivo Comercial o Gerente Comercial activo.';
const SEGMENT_INVALID = 'El segmento no está en el catálogo activo.';
const NOT_FOUND = 'No se encontró la meta.';
const EMPTY_PATCH = 'No hay cambios para guardar.';

type GoalKey = {
  userId: string;
  fiscalYear: number;
  quarter: number;
  segmentId: string;
};

@Injectable()
export class CommercialGoalsService {
  constructor(
    @InjectModel(CommercialGoal)
    private readonly goalModel: typeof CommercialGoal,
    private readonly usersService: UsersService,
    private readonly demandGenerationService: DemandGenerationService,
  ) {}

  async list(
    query: ListCommercialGoalsQueryDto,
  ): Promise<PaginatedCommercialGoalsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.whereFrom(query);
    const { rows, count } = await this.goalModel.findAndCountAll({
      where,
      include: [COMMERCIAL_INCLUDE],
      distinct: true,
      order: [
        ['fiscalYear', 'DESC'],
        ['quarter', 'DESC'],
        [{ model: User, as: 'commercial' }, 'fullName', 'ASC'],
      ],
      limit,
      offset: (page - 1) * limit,
    });
    const names = await this.segmentNames(rows.map((row) => row.segmentId));
    return {
      items: rows.map((row) => this.present(row, names)),
      total: count,
      page,
      limit,
    };
  }

  async summary(
    query: CommercialGoalSummaryQueryDto,
  ): Promise<CommercialGoalSummaryResponseDto> {
    const where: WhereOptions<CommercialGoal> = {
      fiscalYear: query.fiscal_year,
      ...(query.user_id ? { userId: query.user_id } : {}),
      ...(query.segment_id ? { segmentId: query.segment_id } : {}),
    };
    const rows = (await this.goalModel.findAll({
      attributes: [
        'quarter',
        [fn('SUM', col('amount_cop')), 'total_amount_cop'],
        [fn('COUNT', fn('DISTINCT', col('user_id'))), 'commercial_count'],
      ],
      where,
      group: ['quarter'],
      raw: true,
    })) as unknown as Array<{
      quarter: number;
      total_amount_cop: string | number | null;
      commercial_count: string | number | null;
    }>;
    const byQuarter = new Map(rows.map((row) => [Number(row.quarter), row]));
    return {
      fiscal_year: query.fiscal_year,
      quarters: [1, 2, 3, 4].map((quarter) => {
        const row = byQuarter.get(quarter);
        return {
          quarter,
          total_amount_cop: integerDigits(row?.total_amount_cop ?? 0),
          commercial_count: Number(row?.commercial_count ?? 0) || 0,
        };
      }),
    };
  }

  async getById(id: string): Promise<CommercialGoalResponseDto> {
    const goal = await this.findLive(id);
    const names = await this.segmentNames([goal.segmentId]);
    return this.present(goal, names);
  }

  async create(
    dto: CreateCommercialGoalDto,
  ): Promise<CommercialGoalResponseDto> {
    await this.assertCommercial(dto.user_id);
    const segmentName = await this.assertActiveSegment(dto.segment_id);
    const key: GoalKey = {
      userId: dto.user_id,
      fiscalYear: dto.fiscal_year,
      quarter: dto.quarter,
      segmentId: dto.segment_id,
    };
    await this.assertUnique(key, segmentName);
    try {
      const created = await this.goalModel.create({
        userId: key.userId,
        fiscalYear: key.fiscalYear,
        quarter: key.quarter,
        segmentId: key.segmentId,
        amountCop: String(dto.amount_cop),
      });
      return this.getById(created.commercialGoalId);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        const existing = await this.findActive(key);
        this.throwConflict(key, segmentName, existing?.commercialGoalId ?? '');
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateCommercialGoalDto,
  ): Promise<CommercialGoalResponseDto> {
    if (
      dto.user_id === undefined &&
      dto.fiscal_year === undefined &&
      dto.quarter === undefined &&
      dto.segment_id === undefined &&
      dto.amount_cop === undefined
    ) {
      throw new BadRequestException({
        code: 'VALIDATION',
        message: EMPTY_PATCH,
      });
    }

    const goal = await this.findLive(id);
    const key: GoalKey = {
      userId: dto.user_id ?? goal.userId,
      fiscalYear: dto.fiscal_year ?? goal.fiscalYear,
      quarter: dto.quarter ?? goal.quarter,
      segmentId: dto.segment_id ?? goal.segmentId,
    };
    await this.assertCommercial(key.userId);
    const segmentName = await this.assertActiveSegment(key.segmentId);
    await this.assertUnique(key, segmentName, goal.commercialGoalId);

    const patch: Partial<CommercialGoal> = {};
    if (dto.user_id !== undefined) patch.userId = dto.user_id;
    if (dto.fiscal_year !== undefined) patch.fiscalYear = dto.fiscal_year;
    if (dto.quarter !== undefined) patch.quarter = dto.quarter;
    if (dto.segment_id !== undefined) patch.segmentId = dto.segment_id;
    if (dto.amount_cop !== undefined) patch.amountCop = String(dto.amount_cop);

    try {
      await goal.update(patch);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        const existing = await this.findActive(key);
        this.throwConflict(key, segmentName, existing?.commercialGoalId ?? '');
      }
      throw error;
    }

    return this.getById(goal.commercialGoalId);
  }

  async remove(id: string): Promise<DeleteCommercialGoalResponseDto> {
    const goal = await this.findLive(id);
    await goal.destroy();
    return { deleted: true };
  }

  private whereFrom(
    query: ListCommercialGoalsQueryDto,
  ): WhereOptions<CommercialGoal> {
    return {
      ...(query.fiscal_year !== undefined
        ? { fiscalYear: query.fiscal_year }
        : {}),
      ...(query.quarter !== undefined ? { quarter: query.quarter } : {}),
      ...(query.user_id ? { userId: query.user_id } : {}),
      ...(query.segment_id ? { segmentId: query.segment_id } : {}),
    };
  }

  private async findLive(id: string): Promise<CommercialGoal> {
    const goal = await this.goalModel.findByPk(id, {
      include: [COMMERCIAL_INCLUDE],
    });
    if (!goal) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: NOT_FOUND });
    }
    return goal;
  }

  private async findActive(key: GoalKey): Promise<CommercialGoal | null> {
    return this.goalModel.findOne({
      where: {
        userId: key.userId,
        fiscalYear: key.fiscalYear,
        quarter: key.quarter,
        segmentId: key.segmentId,
      },
    });
  }

  private async assertUnique(
    key: GoalKey,
    segmentName: string,
    exceptId?: string,
  ): Promise<void> {
    const existing = await this.findActive(key);
    if (!existing || existing.commercialGoalId === exceptId) {
      return;
    }
    this.throwConflict(key, segmentName, existing.commercialGoalId);
  }

  private throwConflict(
    key: GoalKey,
    segmentName: string,
    existingGoalId: string,
  ): never {
    throw new ConflictException({
      code: 'CONFLICT',
      message: `Ya existe una meta para este comercial en Q${key.quarter} ${key.fiscalYear} · ${segmentName}.`,
      existing_goal_id: existingGoalId,
    });
  }

  private async assertCommercial(userId: string): Promise<void> {
    const allowed = await this.usersService.isActiveWithAnyRole(
      userId,
      ASSIGNABLE_COMMERCIAL_ROLE_NAMES,
    );
    if (!allowed) {
      throw new BadRequestException({
        code: 'VALIDATION',
        message: COMMERCIAL_INVALID,
      });
    }
  }

  private async assertActiveSegment(segmentId: string): Promise<string> {
    const segments = await this.demandGenerationService.listSegments();
    const match = segments.find((segment) => segment.id === segmentId);
    if (!match) {
      throw new BadRequestException({
        code: 'VALIDATION',
        message: SEGMENT_INVALID,
      });
    }
    return match.name;
  }

  private async segmentNames(ids: string[]): Promise<Map<string, string>> {
    return this.demandGenerationService.findSegmentNamesByIds(ids);
  }

  private present(
    goal: CommercialGoal,
    names: Map<string, string>,
  ): CommercialGoalResponseDto {
    return {
      commercial_goal_id: goal.commercialGoalId,
      user_id: goal.userId,
      commercial_full_name: goal.commercial?.fullName ?? '',
      commercial_role_name: goal.commercial?.role?.name ?? '',
      fiscal_year: goal.fiscalYear,
      quarter: goal.quarter,
      segment_id: goal.segmentId,
      segment_name: names.get(goal.segmentId) ?? 'Segmento no disponible',
      amount_cop: integerDigits(goal.amountCop),
      created_at: goal.createdAt,
      updated_at: goal.updatedAt,
    };
  }
}
