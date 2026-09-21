import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { col, fn, Op, QueryTypes, WhereOptions } from 'sequelize';
import { AccountsService } from '../../accounts/services/accounts.service';
import { OuvMarketingMetricsService } from '../../discovery/services/ouv-marketing-metrics.service';
import { OuvOrigenVia } from '../../discovery/models/enums/ouv.enums';
import {
  FunnelStageDto,
  LeadsBySegmentDto,
  MarketingDashboardDetailsQueryDto,
  MarketingDashboardDetailsResponseDto,
  MarketingDashboardQueryDto,
  MarketingDashboardResponseDto,
} from '../dtos/dashboard-response.dto';
import {
  MarketingDashboardTargetRowDto,
  MarketingDashboardTargetsResponseDto,
  UpdateMarketingDashboardTargetsDto,
} from '../dtos/marketing-dashboard-targets.dto';
import { MarketingDashboardTarget } from '../models/marketing-dashboard-target.model';
import { ChecklistResultado } from '../models/enums/checklist.enums';
import { LeadEstado } from '../models/enums/lead.enums';
import { MqlEstado } from '../models/enums/mql.enums';
import { Campaign } from '../models/campaign.model';
import { Interaction } from '../models/interaction.model';
import { Lead } from '../models/lead.model';
import { LeadContact } from '../models/lead-contact.model';
import { LeadChecklist } from '../models/lead-checklist.model';
import { Mql } from '../models/mql.model';
import { Sql } from '../models/sql.model';

const FUNNEL_ORDER: LeadEstado[] = [
  LeadEstado.TOFU,
  LeadEstado.MOFU,
  LeadEstado.MqlPending,
  LeadEstado.SQL,
];

function daysBetween(from: Date | undefined, to: Date | undefined): number | null {
  if (!from || !to) {
    return null;
  }
  const ms = to.getTime() - from.getTime();
  if (!Number.isFinite(ms)) {
    return null;
  }
  return Math.max(0, Math.floor(ms / 86_400_000));
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Lead) private readonly leadModel: typeof Lead,
    @InjectModel(LeadChecklist)
    private readonly checklistModel: typeof LeadChecklist,
    @InjectModel(Mql) private readonly mqlModel: typeof Mql,
    @InjectModel(Sql) private readonly sqlModel: typeof Sql,
    @InjectModel(Campaign) private readonly campaignModel: typeof Campaign,
    @InjectModel(Interaction)
    private readonly interactionModel: typeof Interaction,
    @InjectModel(MarketingDashboardTarget)
    private readonly marketingTargetModel: typeof MarketingDashboardTarget,
    private readonly ouvMarketingMetrics: OuvMarketingMetricsService,
    private readonly accountsService: AccountsService,
  ) {}

  async getMarketingDashboardTargets(): Promise<MarketingDashboardTargetsResponseDto> {
    const rows = await this.marketingTargetModel.findAll({
      order: [['periodType', 'ASC']],
    });
    return { targets: rows.map((row) => this.toTargetRowDto(row)) };
  }

  async updateMarketingDashboardTargets(
    dto: UpdateMarketingDashboardTargetsDto,
  ): Promise<MarketingDashboardTargetsResponseDto> {
    const sequelize = this.marketingTargetModel.sequelize;
    if (!sequelize) {
      return this.getMarketingDashboardTargets();
    }

    await sequelize.transaction(async (transaction) => {
      for (const row of dto.targets) {
        const existing = await this.marketingTargetModel.findOne({
          where: { periodType: row.period_type },
          transaction,
        });
        if (existing) {
          await existing.update(
            {
              interactions: row.interactions,
              periodLeads: row.period_leads,
              convertedOuvs: row.converted_ouvs,
            },
            { transaction },
          );
          continue;
        }
        await this.marketingTargetModel.create(
          {
            periodType: row.period_type,
            interactions: row.interactions,
            periodLeads: row.period_leads,
            convertedOuvs: row.converted_ouvs,
          },
          { transaction },
        );
      }
    });

    return this.getMarketingDashboardTargets();
  }

  private toTargetRowDto(
    row: MarketingDashboardTarget,
  ): MarketingDashboardTargetRowDto {
    return {
      period_type: row.periodType,
      interactions: row.interactions,
      period_leads: row.periodLeads,
      converted_ouvs: row.convertedOuvs,
    };
  }

  async getMarketingDashboard(
    query: MarketingDashboardQueryDto,
  ): Promise<MarketingDashboardResponseDto> {
    const ranges = this.resolveRanges(
      query.quarter,
      query.period_from,
      query.period_to,
      query.year,
    );
    const segmentWhere = this.buildFilteredLeadWhere(ranges);
    const activeLeadDateRange = this.getActiveLeadDateRange(ranges);
    const hasActiveFilter = activeLeadDateRange != null;

    const [
      totalLeads,
      leadsBySegment,
      qualifiedLeads,
      pendingMqls,
      funnel,
      avgCpl,
      weekly,
      averageConversionDays,
    ] = await Promise.all([
      this.leadModel.count(),
      hasActiveFilter
        ? this.countLeadsBySegment(segmentWhere)
        : Promise.resolve([]),
      this.countQualifiedLeads(),
      this.mqlModel.count({ where: { estado: MqlEstado.Activo } }),
      hasActiveFilter
        ? this.buildFunnel(segmentWhere)
        : this.buildEmptyFunnel(),
      this.averageCpl(),
      this.buildWeeklyMetrics(ranges),
      activeLeadDateRange
        ? this.averageLeadToOuvDays(
            activeLeadDateRange.start,
            activeLeadDateRange.end,
          )
        : Promise.resolve(null),
    ]);

    const qualifiedRate =
      totalLeads > 0 ? Number((qualifiedLeads / totalLeads).toFixed(4)) : 0;

    return {
      total_leads: totalLeads,
      leads_by_segment: leadsBySegment,
      qualified_rate: qualifiedRate,
      average_cpl: avgCpl,
      pending_mqls: pendingMqls,
      funnel,
      average_conversion_days: averageConversionDays,
      weekly,
    };
  }

  async getMarketingDashboardDetails(
    query: MarketingDashboardDetailsQueryDto,
  ): Promise<MarketingDashboardDetailsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const ranges = this.resolveRanges(
      query.quarter,
      query.period_from,
      query.period_to,
      query.year,
    );

    const activeRange = this.getActiveLeadDateRange(ranges);

    if (query.kind === 'interactions') {
      if (!activeRange) {
        return this.emptyDetails(query.kind, page, limit);
      }
      return this.listInteractionDetails(
        activeRange.start,
        activeRange.end,
        page,
        limit,
      );
    }
    if (query.kind === 'period_leads') {
      if (!activeRange) {
        return this.emptyDetails(query.kind, page, limit);
      }
      return this.listLeadDetails(
        {
          fechaCaptura: {
            [Op.gte]: activeRange.start,
            [Op.lt]: activeRange.end,
          },
        },
        page,
        limit,
        query.kind,
      );
    }
    if (query.kind === 'quarter_leads') {
      if (
        !ranges.hasAccumulatedRange ||
        !ranges.quarterStart ||
        !ranges.quarterEnd
      ) {
        return this.emptyDetails(query.kind, page, limit);
      }
      return this.listLeadDetails(
        {
          fechaCaptura: {
            [Op.gte]: ranges.quarterStart,
            [Op.lt]: ranges.quarterEnd,
          },
        },
        page,
        limit,
        query.kind,
      );
    }
    if (query.kind === 'funnel') {
      return this.listLeadDetails(
        query.estado ? { estado: query.estado } : {},
        page,
        limit,
        query.kind,
      );
    }

    if (!activeRange) {
      return this.emptyDetails('ouvs', page, limit);
    }

    const ouvs = await this.ouvMarketingMetrics.listConvertedFromMarketing(
      activeRange.start,
      activeRange.end,
      page,
      limit,
    );
    const leadCreatedBySqlId = await this.leadCreatedAtBySqlId(
      ouvs.items.map((ouv) => ouv.sqlIdOrigen),
    );
    return {
      kind: 'ouvs',
      items: ouvs.items.map((ouv) => {
        const leadCreatedAt = ouv.sqlIdOrigen
          ? leadCreatedBySqlId.get(ouv.sqlIdOrigen)
          : undefined;
        return {
          entity: 'ouv' as const,
          id: ouv.ouvId,
          interaction_id: null,
          empresa: ouv.empresaNombre,
          segmento: ouv.segmento,
          origen: ouv.origen,
          canal_origen: ouv.canalOrigen,
          tipo_comunicacion: null,
          canal: null,
          consecutivo: ouv.consecutivo,
          estado: ouv.zonaActual,
          created_at: ouv.createdAt,
          dias_transcurridos: daysBetween(leadCreatedAt, ouv.createdAt),
        };
      }),
      total: ouvs.total,
      page: ouvs.page,
      limit: ouvs.limit,
    };
  }

  private getActiveLeadDateRange(
    ranges: ReturnType<DashboardService['resolveRanges']>,
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

  private buildFilteredLeadWhere(
    ranges: ReturnType<DashboardService['resolveRanges']>,
  ): WhereOptions<Lead> {
    if (ranges.hasPeriodRange && ranges.periodStart && ranges.periodEnd) {
      return {
        fechaCaptura: {
          [Op.gte]: ranges.periodStart,
          [Op.lt]: ranges.periodEnd,
        },
      };
    }
    if (
      ranges.hasAccumulatedRange &&
      ranges.quarterStart &&
      ranges.quarterEnd
    ) {
      return {
        fechaCaptura: {
          [Op.gte]: ranges.quarterStart,
          [Op.lt]: ranges.quarterEnd,
        },
      };
    }
    return {};
  }

  private async countLeadsBySegment(
    where: WhereOptions<Lead>,
  ): Promise<LeadsBySegmentDto[]> {
    const rows = await this.leadModel.findAll({
      attributes: ['segmento', [fn('COUNT', col('lead_id')), 'count']],
      where,
      group: ['segmento'],
      raw: true,
    });

    return (rows as unknown as Array<{ segmento: string; count: number }>).map(
      (row) => ({ segmento: row.segmento, count: Number(row.count) }),
    );
  }

  private async countQualifiedLeads(): Promise<number> {
    return this.checklistModel.count({
      where: { resultado: ChecklistResultado.Calificado },
      distinct: true,
      col: 'lead_id',
    });
  }

  private async buildFunnel(
    where: WhereOptions<Lead>,
  ): Promise<FunnelStageDto[]> {
    const rows = await this.leadModel.findAll({
      attributes: ['estado', [fn('COUNT', col('lead_id')), 'count']],
      where,
      group: ['estado'],
      raw: true,
    });

    const counts = new Map<string, number>();
    for (const row of rows as unknown as Array<{
      estado: string;
      count: number;
    }>) {
      counts.set(row.estado, Number(row.count));
    }

    return FUNNEL_ORDER.map((estado) => ({
      estado,
      count: counts.get(estado) ?? 0,
    }));
  }

  private buildEmptyFunnel(): FunnelStageDto[] {
    return FUNNEL_ORDER.map((estado) => ({ estado, count: 0 }));
  }

  private async averageCpl(): Promise<number | null> {
    const result = (await this.campaignModel.findOne({
      attributes: [[fn('AVG', col('cpl')), 'avgCpl']],
      where: { cpl: { [Op.ne]: null } },
      raw: true,
    })) as unknown as { avgCpl: string | null } | null;

    if (!result?.avgCpl) {
      return null;
    }

    return Number(Number(result.avgCpl).toFixed(2));
  }

  private async buildWeeklyMetrics(
    ranges: ReturnType<DashboardService['resolveRanges']>,
  ) {
    const metricRange = this.getActiveLeadDateRange(ranges);
    const metricLeadWhere: WhereOptions<Lead> | null = metricRange
      ? {
          fechaCaptura: {
            [Op.gte]: metricRange.start,
            [Op.lt]: metricRange.end,
          },
        }
      : null;

    const [
      interactions,
      newLeads,
      leadsByChannel,
      interactionsByChannel,
      convertedOuvs,
    ] = await Promise.all([
      metricRange
        ? this.interactionModel.count({
            where: {
              fecha: {
                [Op.gte]: metricRange.start,
                [Op.lt]: metricRange.end,
              },
            },
          })
        : Promise.resolve(0),
      metricLeadWhere
        ? this.leadModel.count({ where: metricLeadWhere })
        : Promise.resolve(0),
      metricLeadWhere
        ? this.countLeadsByChannel(metricLeadWhere)
        : Promise.resolve([]),
      metricRange
        ? this.countInteractionsByChannel(metricRange.start, metricRange.end)
        : Promise.resolve([]),
      metricRange
        ? this.ouvMarketingMetrics.countConvertedFromMarketing(
            metricRange.start,
            metricRange.end,
          )
        : Promise.resolve(0),
    ]);

    return {
      interactions,
      new_leads: newLeads,
      quarter_leads: ranges.hasAccumulatedRange ? newLeads : 0,
      quarter: ranges.selectedQuarter,
      year: ranges.selectedYear,
      leads_by_channel: ranges.hasPeriodRange ? leadsByChannel : [],
      interactions_by_channel: interactionsByChannel,
      quarter_leads_by_channel: ranges.hasAccumulatedRange ? leadsByChannel : [],
      converted_ouvs: convertedOuvs,
    };
  }

  private resolveRanges(
    quarter?: number,
    periodFrom?: string,
    periodTo?: string,
    year?: number,
  ) {
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

    let selectedQuarter: number | null = null;
    let selectedYear: number | null = year ?? null;
    let quarterStart: Date | null = null;
    let quarterEnd: Date | null = null;
    let hasAccumulatedRange = false;

    if (year != null && quarter != null) {
      selectedQuarter = quarter;
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
      selectedQuarter,
      selectedYear,
    };
  }

  private emptyDetails(
    kind: MarketingDashboardDetailsResponseDto['kind'],
    page: number,
    limit: number,
  ): MarketingDashboardDetailsResponseDto {
    return { kind, items: [], total: 0, page, limit };
  }

  private async listLeadDetails(
    where: WhereOptions<Lead>,
    page: number,
    limit: number,
    kind: MarketingDashboardDetailsResponseDto['kind'],
  ): Promise<MarketingDashboardDetailsResponseDto> {
    const { rows, count } = await this.leadModel.findAndCountAll({
      where,
      include: [{ model: LeadContact, as: 'contacts' }],
      distinct: true,
      order: [['fechaCaptura', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    const empresas = await this.empresaByLead(rows);
    return {
      kind,
      items: rows.map((lead) => ({
        entity: 'lead' as const,
        id: lead.leadId,
        interaction_id: null,
        empresa: empresas.get(lead.leadId) ?? lead.name?.trim() ?? null,
        segmento: lead.segmento,
        origen: lead.origen,
        canal_origen: lead.canalOrigen,
        tipo_comunicacion: null,
        canal: null,
        consecutivo: null,
        estado: lead.estado,
        created_at: lead.createdAt,
        dias_transcurridos: null,
      })),
      total: count,
      page,
      limit,
    };
  }

  private async listInteractionDetails(
    from: Date,
    to: Date,
    page: number,
    limit: number,
  ): Promise<MarketingDashboardDetailsResponseDto> {
    const { rows, count } = await this.interactionModel.findAndCountAll({
      where: { fecha: { [Op.gte]: from, [Op.lt]: to } },
      include: [
        {
          model: Lead,
          as: 'lead',
          required: true,
          include: [{ model: LeadContact, as: 'contacts' }],
        },
      ],
      distinct: true,
      order: [['fecha', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    const empresas = await this.empresaByLead(
      rows.map((row) => row.lead).filter(Boolean),
    );
    return {
      kind: 'interactions',
      items: rows.map((row) => ({
        entity: 'lead' as const,
        id: row.leadId,
        interaction_id: row.interactionId,
        empresa:
          empresas.get(row.leadId) ?? row.lead?.name?.trim() ?? null,
        segmento: row.lead?.segmento ?? null,
        origen: row.lead?.origen ?? null,
        canal_origen: row.lead?.canalOrigen ?? null,
        tipo_comunicacion: row.tipo,
        canal: row.canal,
        consecutivo: null,
        estado: row.lead?.estado ?? null,
        created_at: row.fecha,
        dias_transcurridos: null,
      })),
      total: count,
      page,
      limit,
    };
  }

  private async empresaByLead(leads: Lead[]): Promise<Map<string, string>> {
    const personIds = leads.flatMap(
      (lead) => lead.contacts?.map((contact) => contact.personId) ?? [],
    );
    const peopleMap = await this.accountsService.getPeopleWithAccounts(personIds);
    const empresas = new Map<string, string>();
    for (const lead of leads) {
      const primary =
        lead.contacts?.find((contact) => contact.position === 1) ??
        lead.contacts?.[0];
      const accountName = primary
        ? peopleMap.get(primary.personId)?.account_name?.trim()
        : undefined;
      const empresa = accountName || lead.name?.trim();
      if (empresa) {
        empresas.set(lead.leadId, empresa);
      }
    }
    return empresas;
  }

  private async leadCreatedAtBySqlId(
    sqlIds: Array<string | null | undefined>,
  ): Promise<Map<string, Date>> {
    const ids = [...new Set(sqlIds.filter((id): id is string => Boolean(id)))];
    if (ids.length === 0) {
      return new Map();
    }
    const sqls = await this.sqlModel.findAll({
      where: { sqlId: { [Op.in]: ids } },
      include: [
        {
          model: Mql,
          required: true,
          include: [
            {
              model: Lead,
              required: true,
              attributes: ['leadId', 'fechaCaptura', 'createdAt'],
            },
          ],
        },
      ],
    });
    const dates = new Map<string, Date>();
    for (const sql of sqls) {
      const lead = sql.mql?.lead;
      const created = lead?.fechaCaptura ?? lead?.createdAt;
      if (created) {
        dates.set(sql.sqlId, created);
      }
    }
    return dates;
  }

  private async countLeadsByChannel(where: WhereOptions<Lead>) {
    const rows = await this.leadModel.findAll({
      attributes: [
        'canalOrigen',
        [fn('COUNT', col('lead_id')), 'count'],
      ],
      where,
      group: ['canalOrigen'],
      raw: true,
    });

    return (
      rows as unknown as Array<{ canalOrigen: string; count: number }>
    ).map((row) => ({
      canal_origen: row.canalOrigen,
      count: Number(row.count),
    }));
  }

  private async countInteractionsByChannel(start: Date, end: Date) {
    const rows = await this.interactionModel.findAll({
      attributes: [
        [col('lead.canal_origen'), 'canalOrigen'],
        [fn('COUNT', col('interaction_id')), 'count'],
      ],
      include: [{ model: Lead, as: 'lead', attributes: [], required: true }],
      where: { fecha: { [Op.gte]: start, [Op.lt]: end } },
      group: [col('lead.canal_origen')],
      raw: true,
    });

    return (
      rows as unknown as Array<{ canalOrigen: string; count: number }>
    ).map((row) => ({
      canal_origen: row.canalOrigen,
      count: Number(row.count),
    }));
  }

  private async averageLeadToOuvDays(
    start: Date,
    end: Date,
  ): Promise<number | null> {
    const sequelize = this.leadModel.sequelize;
    if (!sequelize) {
      return null;
    }
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
        AND COALESCE(leads.fecha_captura, leads.created_at) >= :start
        AND COALESCE(leads.fecha_captura, leads.created_at) < :end
      `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          origenVia: OuvOrigenVia.DesdeSql,
          start,
          end,
        },
      },
    );
    if (row?.avg_days == null) {
      return null;
    }
    return Number(Number(row.avg_days).toFixed(1));
  }

}
