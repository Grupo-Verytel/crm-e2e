import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { canReadAllOuvs } from '../../discovery/lib/ouv-access';
import { Ouv } from '../../discovery/models/ouv.model';
import { AssignedOuvsQueryDto } from '../dtos/assigned-ouvs-query.dto';
import {
  AssignedOuvItemDto,
  PaginatedAssignedOuvsDto,
} from '../dtos/assigned-ouvs-response.dto';
import { buildAssignedOuvsSql } from '../lib/assigned-ouvs.query';
import {
  followUpYellowLimit,
  readFollowUpYellowDays,
  type FollowUpStatus,
} from '../lib/follow-up-status';

type AssignedRow = {
  ouv_id: string;
  consecutivo: string;
  titulo: string;
  empresa_nombre: string;
  zona_actual: string;
  comercial_id: string;
  comercial_nombre: string | null;
  next_reminder_at: Date | string | null;
  follow_up_status: FollowUpStatus;
};

@Injectable()
export class AssignedOuvsService implements OnModuleInit {
  constructor(
    @InjectModel(Ouv) private readonly ouvModel: typeof Ouv,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    this.yellowDays();
  }

  async list(
    query: AssignedOuvsQueryDto,
    actorUserId: string,
    actorRoleName: string,
    now = new Date(),
  ): Promise<PaginatedAssignedOuvsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const yellowDays = this.yellowDays();
    const comercialId = canReadAllOuvs(actorRoleName)
      ? (query.comercial_id ?? null)
      : actorUserId;
    const { listSql, countSql, replacements } = buildAssignedOuvsSql({
      comercialId,
      search: query.search?.trim() || null,
      statuses: query.follow_up_status ?? null,
      now,
      yellowLimit: followUpYellowLimit(now, yellowDays),
      limit,
      offset: (page - 1) * limit,
    });
    const sequelize = this.ouvModel.sequelize;
    if (!sequelize) {
      throw new Error('Ouv model has no sequelize connection');
    }

    const [rows, totals] = await Promise.all([
      sequelize.query<AssignedRow>(listSql, {
        replacements,
        type: QueryTypes.SELECT,
      }),
      sequelize.query<{ total: number | string }>(countSql, {
        replacements,
        type: QueryTypes.SELECT,
      }),
    ]);

    return {
      items: rows.map((row) => this.present(row)),
      total: Number(totals[0]?.total ?? 0),
      page,
      limit,
    };
  }

  private yellowDays(): number {
    return readFollowUpYellowDays(
      this.configService.get('FOLLOW_UP_YELLOW_DAYS'),
    );
  }

  private present(row: AssignedRow): AssignedOuvItemDto {
    return {
      ouv_id: row.ouv_id,
      consecutivo: row.consecutivo,
      titulo: row.titulo,
      empresa_nombre: row.empresa_nombre,
      zona_actual: row.zona_actual,
      comercial_id: row.comercial_id,
      comercial_nombre: row.comercial_nombre,
      next_reminder_at: row.next_reminder_at
        ? new Date(row.next_reminder_at)
        : null,
      follow_up_status: row.follow_up_status,
    };
  }
}
