import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { isCanalAllowedForTipo } from '../../demand-generation/models/enums/interaction.enums';
import { Sql } from '../../demand-generation/models/sql.model';
import { QUALIFICATION_ERROR_CODES } from '../constants/qualification.constants';
import { CreateSqlInteractionDto } from '../dtos/create-sql-interaction.dto';
import { SqlInteractionResponseDto } from '../dtos/sql-interaction-response.dto';
import { SqlInteraction } from '../models/sql-interaction.model';

@Injectable()
export class SqlInteractionsService {
  constructor(
    @InjectModel(SqlInteraction)
    private readonly sqlInteractionModel: typeof SqlInteraction,
    @InjectModel(Sql) private readonly sqlModel: typeof Sql,
  ) {}

  async create(
    sqlId: string,
    dto: CreateSqlInteractionDto,
    responsableId: string,
  ): Promise<SqlInteractionResponseDto> {
    await this.findSqlOrFail(sqlId);

    if (!isCanalAllowedForTipo(dto.tipo, dto.canal)) {
      throw new BadRequestException({
        code: QUALIFICATION_ERROR_CODES.VALIDATION_ERROR,
        message: `Canal ${dto.canal} is not valid for interaction type ${dto.tipo}`,
      });
    }

    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();

    const interaction = await this.sqlInteractionModel.create({
      sqlId,
      tipo: dto.tipo,
      canal: dto.canal,
      subtipo: dto.subtipo ?? null,
      descripcion: dto.descripcion ?? null,
      responsableId,
      fecha,
    });

    return this.toResponseDto(interaction);
  }

  async listBySql(sqlId: string): Promise<SqlInteractionResponseDto[]> {
    await this.findSqlOrFail(sqlId);

    const interactions = await this.sqlInteractionModel.findAll({
      where: { sqlId },
      order: [['fecha', 'DESC']],
    });

    return interactions.map((row) => this.toResponseDto(row));
  }

  private async findSqlOrFail(sqlId: string): Promise<Sql> {
    const sql = await this.sqlModel.findByPk(sqlId);
    if (!sql) {
      throw new NotFoundException({
        code: QUALIFICATION_ERROR_CODES.NOT_FOUND,
        message: `SQL ${sqlId} not found`,
      });
    }
    return sql;
  }

  private toResponseDto(row: SqlInteraction): SqlInteractionResponseDto {
    return {
      sql_interaction_id: row.sqlInteractionId,
      sql_id: row.sqlId,
      tipo: row.tipo,
      subtipo: row.subtipo,
      canal: row.canal,
      descripcion: row.descripcion,
      responsable_id: row.responsableId,
      fecha: row.fecha,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }
}
