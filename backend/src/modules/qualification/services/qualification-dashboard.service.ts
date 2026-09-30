import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Lead } from '../../demand-generation/models/lead.model';
import { Mql } from '../../demand-generation/models/mql.model';
import { MqlEstado } from '../../demand-generation/models/enums/mql.enums';
import { SqlEstado } from '../../demand-generation/models/enums/sql.enums';
import { Sql } from '../../demand-generation/models/sql.model';
import {
  OuvResultado,
  OuvZona,
} from '../../discovery/models/enums/ouv.enums';
import { Ouv } from '../../discovery/models/ouv.model';
import {
  QualificationDashboardDetailsQueryDto,
  QualificationDashboardDetailsResponseDto,
  QualificationDashboardDetailItemDto,
  QualificationDashboardDetailKind,
} from '../dtos/qualification-dashboard-detail.dto';
import {
  QualificationDashboardQueryDto,
  QualificationDashboardResponseDto,
} from '../dtos/qualification-dashboard.dto';
import { SqlCita } from '../models/sql-cita.model';
import { SqlCitaEstado } from '../models/enums/sql-cita-estado.enum';

type ResolvedRanges = {
  hasPeriodRange: boolean;
  hasAccumulatedRange: boolean;
  periodStart: Date | null;
  periodEnd: Date | null;
  quarterStart: Date | null;
  quarterEnd: Date | null;
};

@Injectable()
export class QualificationDashboardService {
  constructor(
    @InjectModel(Mql) private readonly mqlModel: typeof Mql,
    @InjectModel(Sql) private readonly sqlModel: typeof Sql,
    @InjectModel(SqlCita) private readonly sqlCitaModel: typeof SqlCita,
    @InjectModel(Ouv) private readonly ouvModel: typeof Ouv,
  ) {}

  async getDashboard(
    query: QualificationDashboardQueryDto,
  ): Promise<QualificationDashboardResponseDto> {
    const ranges = this.resolveRanges(
      query.quarter,
      query.period_from,
      query.period_to,
      query.year,
    );
    const activeRange = this.getActiveDateRange(ranges);
    const periodActive = activeRange != null;

    const [
      mqlPendingTotal,
      mqlWithoutCita,
      mqlWithCita,
      scheduledByCommercial,
      executedCitas,
      sqlAssignedInPeriod,
      sqlConvertedToOuvInPeriod,
      ouvsReadyOffer,
      ouvsWonInPeriod,
    ] = await Promise.all([
      this.countMqlBandejaPending(),
      this.countMqlBandejaByLeadCita(false),
      this.countMqlBandejaByLeadCita(true),
      periodActive
        ? this.countCitasByEstados(
            activeRange!.start,
            activeRange!.end,
            [SqlCitaEstado.Agendada, SqlCitaEstado.Reagendada],
          )
        : Promise.resolve(0),
      periodActive
        ? this.countCitasByEstados(
            activeRange!.start,
            activeRange!.end,
            [
              SqlCitaEstado.Realizada,
              SqlCitaEstado.Cancelada,
              SqlCitaEstado.NoAsistio,
            ],
          )
        : Promise.resolve(0),
      periodActive
        ? this.countSqlAssignedInRange(activeRange!.start, activeRange!.end)
        : Promise.resolve(0),
      periodActive
        ? this.countSqlConvertedToOuvAssignedInRange(
            activeRange!.start,
            activeRange!.end,
          )
        : Promise.resolve(0),
      this.countOuvsReadyForOfferClosing(),
      periodActive
        ? this.countOuvsWonInRange(activeRange!.start, activeRange!.end)
        : Promise.resolve(0),
    ]);

    const sqlToOuvConversionRate =
      sqlAssignedInPeriod > 0
        ? Number(
            (sqlConvertedToOuvInPeriod / sqlAssignedInPeriod).toFixed(4),
          )
        : null;

    return {
      period: {
        active: periodActive,
        period_from: query.period_from ?? null,
        period_to: query.period_to ?? null,
        year: query.year ?? null,
        quarter: query.quarter ?? null,
      },
      mql_bandeja: {
        pending_total: mqlPendingTotal,
        without_cita: mqlWithoutCita,
        with_cita: mqlWithCita,
      },
      citas_calificacion: {
        scheduled_by_commercial: scheduledByCommercial,
        executed: executedCitas,
        sql_assigned_in_period: sqlAssignedInPeriod,
        sql_converted_to_ouv_in_period: sqlConvertedToOuvInPeriod,
        sql_to_ouv_conversion_rate: sqlToOuvConversionRate,
      },
      pipeline: {
        ouvs_ready_for_offer_closing: ouvsReadyOffer,
        ouvs_won_in_period: ouvsWonInPeriod,
      },
    };
  }

  async getDashboardDetails(
    query: QualificationDashboardDetailsQueryDto,
  ): Promise<QualificationDashboardDetailsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const ranges = this.resolveRanges(
      query.quarter,
      query.period_from,
      query.period_to,
      query.year,
    );
    const activeRange = this.getActiveDateRange(ranges);

    switch (query.kind) {
      case 'mql_bandeja':
        return this.listMqlBandejaDetails(false, page, limit, offset);
      case 'mql_with_cita':
        return this.listMqlBandejaDetails(true, page, limit, offset);
      case 'citas_scheduled':
        if (!activeRange) {
          return this.emptyDetails(query.kind, page, limit);
        }
        return this.listCitaDetails(
          activeRange.start,
          activeRange.end,
          [SqlCitaEstado.Agendada, SqlCitaEstado.Reagendada],
          page,
          limit,
          offset,
        );
      case 'citas_executed':
        if (!activeRange) {
          return this.emptyDetails(query.kind, page, limit);
        }
        return this.listCitaDetails(
          activeRange.start,
          activeRange.end,
          [
            SqlCitaEstado.Realizada,
            SqlCitaEstado.Cancelada,
            SqlCitaEstado.NoAsistio,
          ],
          page,
          limit,
          offset,
        );
      case 'sql_converted_ouv':
        if (!activeRange) {
          return this.emptyDetails(query.kind, page, limit);
        }
        return this.listSqlConvertedDetails(
          activeRange.start,
          activeRange.end,
          page,
          limit,
          offset,
        );
      case 'ouvs_ready_offer':
        return this.listOuvReadyDetails(page, limit, offset);
      case 'ouvs_won':
        if (!activeRange) {
          return this.emptyDetails(query.kind, page, limit);
        }
        return this.listOuvWonDetails(
          activeRange.start,
          activeRange.end,
          page,
          limit,
          offset,
        );
      default:
        return this.emptyDetails(query.kind, page, limit);
    }
  }

  private emptyDetails(
    kind: QualificationDashboardDetailKind,
    page: number,
    limit: number,
  ): QualificationDashboardDetailsResponseDto {
    return { kind, items: [], total: 0, page, limit };
  }

  private async listMqlBandejaDetails(
    withCitaOnly: boolean,
    page: number,
    limit: number,
    offset: number,
  ): Promise<QualificationDashboardDetailsResponseDto> {
    const kind: QualificationDashboardDetailKind = withCitaOnly
      ? 'mql_with_cita'
      : 'mql_bandeja';
    const { rows, count } = await this.mqlModel.findAndCountAll({
      where: { estado: MqlEstado.Activo },
      include: [
        {
          model: Lead,
          required: true,
          where: withCitaOnly
            ? { fechaCita: { [Op.not]: null } }
            : undefined,
        },
      ],
      order: [['fecha_calificacion', 'DESC']],
      offset,
      limit,
      distinct: true,
    });

    const mqlIds = rows.map((mql) => mql.mqlId);
    const sqlRows =
      mqlIds.length > 0
        ? await this.sqlModel.findAll({
            where: { mqlId: { [Op.in]: mqlIds } },
            attributes: ['sqlId', 'mqlId'],
          })
        : [];
    const sqlIdByMqlId = new Map(
      sqlRows.map((sql) => [sql.mqlId, sql.sqlId] as const),
    );

    const items: QualificationDashboardDetailItemDto[] = rows.map((mql) => {
      const lead = mql.lead;
      return {
        entity: 'lead',
        id: lead.leadId,
        label: lead.name?.trim() || lead.leadId,
        segmento: lead.segmento,
        estado: 'MQL Activo',
        detail: lead.fechaCita
          ? `Cita lead: ${lead.fechaCita.toISOString().slice(0, 10)}`
          : 'Sin cita en lead',
        occurred_at: mql.fechaCalificacion?.toISOString() ?? null,
        sql_id: sqlIdByMqlId.get(mql.mqlId) ?? null,
      };
    });

    return { kind, items, total: count, page, limit };
  }

  private async listCitaDetails(
    start: Date,
    end: Date,
    estados: SqlCitaEstado[],
    page: number,
    limit: number,
    offset: number,
  ): Promise<QualificationDashboardDetailsResponseDto> {
    const kind: QualificationDashboardDetailKind =
      estados.includes(SqlCitaEstado.Agendada) ||
      estados.includes(SqlCitaEstado.Reagendada)
        ? 'citas_scheduled'
        : 'citas_executed';
    const startDay = start.toISOString().slice(0, 10);
    const endDay = new Date(end.getTime() - 1).toISOString().slice(0, 10);

    const { rows, count } = await this.sqlCitaModel.findAndCountAll({
      where: {
        estado: { [Op.in]: estados },
        fecha: { [Op.gte]: startDay, [Op.lte]: endDay },
      },
      include: [
        {
          model: Sql,
          required: true,
          include: [
            {
              model: Mql,
              required: true,
              include: [{ model: Lead, required: true }],
            },
          ],
        },
      ],
      order: [
        ['fecha', 'DESC'],
        ['hora', 'DESC'],
      ],
      offset,
      limit,
    });

    const items: QualificationDashboardDetailItemDto[] = rows.map((cita) => {
      const lead = cita.sql?.mql?.lead;
      return {
        entity: 'cita',
        id: cita.citaId,
        label: lead?.name?.trim() || cita.contactoNombre,
        segmento: lead?.segmento ?? null,
        estado: cita.estado,
        detail: `${cita.lugar} · ${cita.fecha} ${String(cita.hora).slice(0, 5)}`,
        occurred_at: `${cita.fecha}T${String(cita.hora).slice(0, 8)}`,
        sql_id: cita.sql?.sqlId ?? null,
      };
    });

    return { kind, items, total: count, page, limit };
  }

  private async listSqlConvertedDetails(
    start: Date,
    end: Date,
    page: number,
    limit: number,
    offset: number,
  ): Promise<QualificationDashboardDetailsResponseDto> {
    const { rows, count } = await this.sqlModel.findAndCountAll({
      where: {
        estado: SqlEstado.ConvertidoOUV,
        ouvId: { [Op.not]: null },
        comercialAsignadoId: { [Op.not]: null },
        fechaAsignacion: { [Op.gte]: start, [Op.lt]: end },
      },
      include: [
        {
          model: Mql,
          required: true,
          include: [{ model: Lead, required: true }],
        },
      ],
      order: [['fecha_asignacion', 'DESC']],
      offset,
      limit,
    });

    const ouvIds = rows
      .map((sql) => sql.ouvId)
      .filter((id): id is string => Boolean(id));
    const ouvs =
      ouvIds.length > 0
        ? await this.ouvModel.findAll({
            where: { ouvId: { [Op.in]: ouvIds } },
            attributes: ['ouvId', 'consecutivo'],
          })
        : [];
    const ouvById = new Map(ouvs.map((ouv) => [ouv.ouvId, ouv.consecutivo]));

    const items: QualificationDashboardDetailItemDto[] = rows.map((sql) => {
      const lead = sql.mql?.lead;
      const consecutivo = sql.ouvId
        ? (ouvById.get(sql.ouvId) ?? sql.ouvId)
        : null;
      return {
        entity: 'sql',
        id: sql.sqlId,
        label: lead?.name?.trim() || sql.sqlId,
        segmento: lead?.segmento ?? null,
        estado: sql.estado,
        detail: consecutivo ? `OUV ${consecutivo}` : null,
        occurred_at: sql.fechaAsignacion?.toISOString() ?? null,
        sql_id: sql.sqlId,
      };
    });

    return {
      kind: 'sql_converted_ouv',
      items,
      total: count,
      page,
      limit,
    };
  }

  private async listOuvReadyDetails(
    page: number,
    limit: number,
    offset: number,
  ): Promise<QualificationDashboardDetailsResponseDto> {
    const { rows, count } = await this.ouvModel.findAndCountAll({
      where: {
        zonaActual: OuvZona.MayorProbabilidad,
        resultado: OuvResultado.EnCurso,
      },
      order: [['updated_at', 'DESC']],
      offset,
      limit,
    });

    const items: QualificationDashboardDetailItemDto[] = rows.map((ouv) => ({
      entity: 'ouv',
      id: ouv.ouvId,
      label: ouv.titulo,
      segmento: ouv.segmento,
      estado: ouv.zonaActual,
      detail: ouv.consecutivo,
      occurred_at: ouv.updatedAt?.toISOString() ?? null,
      sql_id: null,
    }));

    return {
      kind: 'ouvs_ready_offer',
      items,
      total: count,
      page,
      limit,
    };
  }

  private async listOuvWonDetails(
    start: Date,
    end: Date,
    page: number,
    limit: number,
    offset: number,
  ): Promise<QualificationDashboardDetailsResponseDto> {
    const { rows, count } = await this.ouvModel.findAndCountAll({
      where: {
        resultado: OuvResultado.Ganada,
        updatedAt: { [Op.gte]: start, [Op.lt]: end },
      },
      order: [['updated_at', 'DESC']],
      offset,
      limit,
    });

    const items: QualificationDashboardDetailItemDto[] = rows.map((ouv) => ({
      entity: 'ouv',
      id: ouv.ouvId,
      label: ouv.titulo,
      segmento: ouv.segmento,
      estado: ouv.resultado,
      detail: ouv.consecutivo,
      occurred_at: ouv.updatedAt?.toISOString() ?? null,
      sql_id: null,
    }));

    return {
      kind: 'ouvs_won',
      items,
      total: count,
      page,
      limit,
    };
  }

  private async countMqlBandejaPending(): Promise<number> {
    return this.mqlModel.count({
      where: { estado: MqlEstado.Activo },
    });
  }

  private async countMqlBandejaByLeadCita(hasCita: boolean): Promise<number> {
    return this.mqlModel.count({
      where: { estado: MqlEstado.Activo },
      include: [
        {
          model: Lead,
          required: true,
          where: hasCita
            ? { fechaCita: { [Op.not]: null } }
            : { fechaCita: { [Op.is]: null } },
        },
      ],
      distinct: true,
      col: 'mql_id',
    });
  }

  private async countSqlAssignedInRange(
    start: Date,
    end: Date,
  ): Promise<number> {
    return this.sqlModel.count({
      where: {
        comercialAsignadoId: { [Op.not]: null },
        fechaAsignacion: { [Op.gte]: start, [Op.lt]: end },
      },
    });
  }

  private async countSqlConvertedToOuvAssignedInRange(
    start: Date,
    end: Date,
  ): Promise<number> {
    return this.sqlModel.count({
      where: {
        estado: SqlEstado.ConvertidoOUV,
        ouvId: { [Op.not]: null },
        comercialAsignadoId: { [Op.not]: null },
        fechaAsignacion: { [Op.gte]: start, [Op.lt]: end },
      },
    });
  }

  private async countCitasByEstados(
    start: Date,
    end: Date,
    estados: SqlCitaEstado[],
  ): Promise<number> {
    const startDay = start.toISOString().slice(0, 10);
    const endDay = new Date(end.getTime() - 1).toISOString().slice(0, 10);

    return this.sqlCitaModel.count({
      where: {
        estado: { [Op.in]: estados },
        fecha: { [Op.gte]: startDay, [Op.lte]: endDay },
      },
    });
  }

  private async countOuvsReadyForOfferClosing(): Promise<number> {
    return this.ouvModel.count({
      where: {
        zonaActual: OuvZona.MayorProbabilidad,
        resultado: OuvResultado.EnCurso,
      },
    });
  }

  private async countOuvsWonInRange(start: Date, end: Date): Promise<number> {
    return this.ouvModel.count({
      where: {
        resultado: OuvResultado.Ganada,
        updatedAt: { [Op.gte]: start, [Op.lt]: end },
      },
    });
  }

  private getActiveDateRange(
    ranges: ResolvedRanges,
  ): { start: Date; end: Date } | null {
    if (ranges.hasPeriodRange && ranges.periodStart && ranges.periodEnd) {
      return { start: ranges.periodStart, end: ranges.periodEnd };
    }
    if (
      ranges.hasAccumulatedRange &&
      ranges.quarterStart &&
      ranges.quarterEnd
    ) {
      return { start: ranges.quarterStart, end: ranges.quarterEnd };
    }
    return null;
  }

  private resolveRanges(
    quarter?: number,
    periodFrom?: string,
    periodTo?: string,
    year?: number,
  ): ResolvedRanges {
    const hasPeriodRange = Boolean(periodFrom && periodTo);
    const periodStart = hasPeriodRange
      ? new Date(`${periodFrom!.slice(0, 10)}T05:00:00.000Z`)
      : null;
    const periodEnd = hasPeriodRange
      ? new Date(
          new Date(`${periodTo!.slice(0, 10)}T05:00:00.000Z`).getTime() +
            24 * 60 * 60 * 1000,
        )
      : null;

    let quarterStart: Date | null = null;
    let quarterEnd: Date | null = null;
    let hasAccumulatedRange = false;

    if (year != null && quarter != null) {
      hasAccumulatedRange = true;
      quarterStart = new Date(Date.UTC(year, (quarter - 1) * 3, 1, 5));
      quarterEnd = new Date(Date.UTC(year, quarter * 3, 1, 5));
    } else if (year != null) {
      hasAccumulatedRange = true;
      quarterStart = new Date(Date.UTC(year, 0, 1, 5));
      quarterEnd = new Date(Date.UTC(year + 1, 0, 1, 5));
    }

    return {
      hasPeriodRange,
      hasAccumulatedRange,
      periodStart,
      periodEnd,
      quarterStart,
      quarterEnd,
    };
  }
}
