import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, QueryTypes } from 'sequelize';
import { OuvOrigenVia } from '../models/enums/ouv.enums';
import { Ouv } from '../models/ouv.model';

export type ConvertedMarketingOuv = {
  ouvId: string;
  consecutivo: string;
  empresaNombre: string;
  segmento: string;
  origen: string | null;
  canalOrigen: string | null;
  zonaActual: string;
  createdAt: Date;
  sqlIdOrigen: string | null;
};

@Injectable()
export class OuvMarketingMetricsService {
  constructor(@InjectModel(Ouv) private readonly ouvModel: typeof Ouv) {}

  async countConvertedFromMarketing(from: Date, to: Date): Promise<number> {
    return this.ouvModel.count({
      where: {
        origenVia: OuvOrigenVia.DesdeSql,
        createdAt: { [Op.gte]: from, [Op.lt]: to },
      },
    });
  }

  async listConvertedFromMarketing(
    from: Date,
    to: Date,
    page = 1,
    limit = 20,
  ): Promise<{
    items: ConvertedMarketingOuv[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { rows, count } = await this.ouvModel.findAndCountAll({
      where: {
        origenVia: OuvOrigenVia.DesdeSql,
        createdAt: { [Op.gte]: from, [Op.lt]: to },
      },
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    return {
      items: rows.map((ouv) => ({
        ouvId: ouv.ouvId,
        consecutivo: ouv.consecutivo,
        empresaNombre: ouv.empresaNombre,
        segmento: ouv.segmento,
        origen: ouv.origin,
        canalOrigen: ouv.sourceChannel,
        zonaActual: ouv.zonaActual,
        createdAt: ouv.createdAt,
        sqlIdOrigen: ouv.sqlIdOrigen,
      })),
      total: count,
      page,
      limit,
    };
  }

  async averageLeadToOuvDays(
    start?: Date,
    end?: Date,
  ): Promise<number | null> {
    const sequelize = this.ouvModel.sequelize;
    if (!sequelize) {
      return null;
    }
    const dateFilter =
      start && end
        ? `
        AND COALESCE(leads.fecha_captura, leads.created_at) >= :start
        AND COALESCE(leads.fecha_captura, leads.created_at) < :end`
        : '';
    const [row] = await sequelize.query<{ avg_days: string | number | null }>(
      `
      SELECT AVG(
        TIMESTAMPDIFF(
          DAY,
          COALESCE(leads.fecha_captura, leads.created_at),
          ouvs.created_at
        )
      ) AS avg_days
      FROM ouvs
      INNER JOIN sqls
        ON sqls.sql_id = ouvs.sql_id_origen
        AND sqls.deleted_at IS NULL
      INNER JOIN mqls
        ON mqls.mql_id = sqls.mql_id
        AND mqls.deleted_at IS NULL
      INNER JOIN leads
        ON leads.lead_id = mqls.lead_id
        AND leads.deleted_at IS NULL
      WHERE ouvs.origen_via = :origenVia
      ${dateFilter}
      `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          origenVia: OuvOrigenVia.DesdeSql,
          ...(start && end ? { start, end } : {}),
        },
      },
    );
    if (row?.avg_days == null) {
      return null;
    }
    return Number(Number(row.avg_days).toFixed(1));
  }
}
