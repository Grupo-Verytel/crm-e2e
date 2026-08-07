import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { QueryTypes, Sequelize, type Transaction } from 'sequelize';
import type { CrearOuvDto } from '../dtos/crear-ouv.dto';
import type { OuvResponseDto } from '../dtos/ouv-response.dto';
import { OuvResultado, OuvZona } from '../models/enums/ouv.enums';
import { Ouv } from '../models/ouv.model';

export type CrearDesdeSqlInput = {
  sqlId: string;
  comercialId: string;
  dto: CrearOuvDto;
};

@Injectable()
export class OuvsService {
  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    @InjectModel(Ouv) private readonly ouvModel: typeof Ouv,
  ) {}

  /**
   * Creates an OUV in UNIVERSO / EnCurso from a SQL (EARS-12).
   * Must run inside the caller's transaction.
   */
  async crearDesdeSql(
    input: CrearDesdeSqlInput,
    transaction: Transaction,
  ): Promise<Ouv> {
    const consecutivo = await this.nextOuvConsecutivo(transaction);

    return this.ouvModel.create(
      {
        consecutivo,
        sqlIdOrigen: input.sqlId,
        comercialId: input.comercialId,
        titulo: input.dto.titulo.trim(),
        descripcion: input.dto.descripcion?.trim() || null,
        segmento: input.dto.segmento,
        vertical: input.dto.vertical,
        zonaActual: OuvZona.Universo,
        resultado: OuvResultado.EnCurso,
      },
      { transaction },
    );
  }

  async findById(ouvId: string): Promise<Ouv | null> {
    return this.ouvModel.findByPk(ouvId);
  }

  toResponse(ouv: Ouv): OuvResponseDto {
    return {
      ouv_id: ouv.ouvId,
      consecutivo: ouv.consecutivo,
      sql_id_origen: ouv.sqlIdOrigen,
      comercial_id: ouv.comercialId,
      titulo: ouv.titulo,
      descripcion: ouv.descripcion,
      segmento: ouv.segmento,
      vertical: ouv.vertical,
      zona_actual: ouv.zonaActual,
      resultado: ouv.resultado,
      created_at: ouv.createdAt,
      updated_at: ouv.updatedAt,
    };
  }

  /**
   * Temporary MAX+FOR UPDATE sequence (Wave 1).
   * TODO: migrate to secuenciadores when Modules 3–5 land.
   */
  private async nextOuvConsecutivo(transaction: Transaction): Promise<string> {
    const rows = await this.sequelize.query<{ siguiente: number }>(
      `
        SELECT COALESCE(MAX(CAST(SUBSTRING(consecutivo, 5) AS UNSIGNED)), 0) + 1
          AS siguiente
        FROM ouvs
        FOR UPDATE
      `,
      { transaction, type: QueryTypes.SELECT },
    );
    const siguiente = Number(rows[0]?.siguiente ?? 1);
    return `OUV-${String(siguiente).padStart(4, '0')}`;
  }
}
