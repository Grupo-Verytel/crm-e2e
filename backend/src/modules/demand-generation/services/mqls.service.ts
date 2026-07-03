import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { WhereOptions } from 'sequelize';
import { ApproveMqlDto } from '../dtos/approve-mql.dto';
import {
  ApproveMqlResponseDto,
  MqlResponseDto,
  MqlsQueryDto,
  PaginatedMqlsResponseDto,
  SqlResponseDto,
} from '../dtos/mql-response.dto';
import { RejectMqlDto } from '../dtos/reject-mql.dto';
import { Mql } from '../models/mql.model';
import { Sql } from '../models/sql.model';
import { LeadStateMachineService } from './lead-state-machine.service';

@Injectable()
export class MqlsService {
  constructor(
    @InjectModel(Mql) private readonly mqlModel: typeof Mql,
    private readonly stateMachine: LeadStateMachineService,
  ) {}

  async findAll(query: MqlsQueryDto): Promise<PaginatedMqlsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const where: WhereOptions<Mql> = {};

    if (query.estado) {
      where.estado = query.estado;
    }

    const { rows, count } = await this.mqlModel.findAndCountAll({
      where,
      order: [['fechaCalificacion', 'DESC']],
      limit,
      offset,
    });

    return {
      items: rows.map((mql) => this.toResponseDto(mql)),
      total: count,
      page,
      limit,
    };
  }

  async approve(
    mqlId: string,
    dto: ApproveMqlDto,
    userId: string,
  ): Promise<ApproveMqlResponseDto> {
    const { mql, sql } = await this.stateMachine.approveMql(
      mqlId,
      userId,
      dto.comentario,
    );

    return {
      mql: this.toResponseDto(mql),
      sql: this.toSqlResponseDto(sql),
    };
  }

  async reject(
    mqlId: string,
    dto: RejectMqlDto,
    userId: string,
  ): Promise<MqlResponseDto> {
    const { mql } = await this.stateMachine.rejectMql(
      mqlId,
      userId,
      dto.motivo,
    );
    return this.toResponseDto(mql);
  }

  toResponseDto(mql: Mql): MqlResponseDto {
    return {
      mql_id: mql.mqlId,
      lead_id: mql.leadId,
      checklist_id: mql.checklistId,
      calificado_por: mql.calificadoPor,
      fecha_calificacion: mql.fechaCalificacion,
      motivo_calificacion: mql.motivoCalificacion,
      estado: mql.estado,
      created_at: mql.createdAt,
      updated_at: mql.updatedAt,
    };
  }

  toSqlResponseDto(sql: Sql): SqlResponseDto {
    return {
      sql_id: sql.sqlId,
      mql_id: sql.mqlId,
      en_backlog: sql.enBacklog,
      comercial_asignado_id: sql.comercialAsignadoId,
      fecha_creacion: sql.fechaCreacion,
    };
  }
}
