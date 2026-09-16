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
    private readonly ouvMarketingMetrics: OuvMarketingMetricsService,
    private readonly accountsService: AccountsService,
  ) {}

  async getMarketingDashboard(
    query: MarketingDashboardQueryDto,
  ): Promise<MarketingDashboardResponseDto> {
    const leadWhere = this.buildLeadWhere(query);

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
      this.leadModel.count({ where: leadWhere }),
      this.countLeadsBySegment(leadWhere),
      this.countQualifiedLeads(),
      this.mqlModel.count({ where: { estado: MqlEstado.Activo } }),
      this.buildFunnel(leadWhere),
      this.averageCpl(),
      this.buildWeeklyMetrics(
        query.quarter,
        query.period_from,
        query.period_to,
      ),
      this.averageLeadToOuvDays(),
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
    const ranges = this.resolveRanges(query.quarter, query.period_from, query.period_to);

    if (query.kind === 'interactions') {
      return this.listInteractionDetails(
        ranges.periodStart,
        ranges.periodEnd,
        page,
        limit,
      );
    }
    if (query.kind === 'period_leads') {
      return this.listLeadDetails(
        {
          fechaCaptura: {
            [Op.gte]: ranges.periodStart,
            [Op.lt]: ranges.periodEnd,
          },
        },
        page,
        limit,
        query.kind,
      );
    }
    if (query.kind === 'quarter_leads') {
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

    const ouvs = await this.ouvMarketingMetrics.listConvertedFromMarketing(
      ranges.periodStart,
      ranges.periodEnd,
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

  private buildLeadWhere(
    query: MarketingDashboardQueryDto,
  ): WhereOptions<Lead> {
    const where: WhereOptions<Lead> = {};

    if (query.from || query.to) {
      where.fechaCaptura = {
        ...(query.from ? { [Op.gte]: new Date(query.from) } : {}),
        ...(query.to ? { [Op.lte]: new Date(query.to) } : {}),
      };
    }

    return where;
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
    quarter?: number,
    periodFrom?: string,
    periodTo?: string,
  ) {
    const {
      periodStart,
      periodEnd,
      quarterStart,
      quarterEnd,
      selectedQuarter,
    } = this.resolveRanges(quarter, periodFrom, periodTo);

    const periodLeadWhere: WhereOptions<Lead> = {
      fechaCaptura: { [Op.gte]: periodStart, [Op.lt]: periodEnd },
    };
    const quarterLeadWhere: WhereOptions<Lead> = {
      fechaCaptura: { [Op.gte]: quarterStart, [Op.lt]: quarterEnd },
    };
    const [
      interactions,
      newLeads,
      quarterLeads,
      leadsByChannel,
      interactionsByChannel,
      quarterLeadsByChannel,
      convertedOuvs,
    ] = await Promise.all([
      this.interactionModel.count({
        where: { fecha: { [Op.gte]: periodStart, [Op.lt]: periodEnd } },
      }),
      this.leadModel.count({ where: periodLeadWhere }),
      this.leadModel.count({ where: quarterLeadWhere }),
      this.countLeadsByChannel(periodLeadWhere),
      this.countInteractionsByChannel(periodStart, periodEnd),
      this.countLeadsByChannel(quarterLeadWhere),
      this.ouvMarketingMetrics.countConvertedFromMarketing(periodStart, periodEnd),
    ]);

    return {
      interactions,
      new_leads: newLeads,
      quarter_leads: quarterLeads,
      quarter: selectedQuarter,
      leads_by_channel: leadsByChannel,
      interactions_by_channel: interactionsByChannel,
      quarter_leads_by_channel: quarterLeadsByChannel,
      converted_ouvs: convertedOuvs,
    };
  }

  private resolveRanges(
    quarter?: number,
    periodFrom?: string,
    periodTo?: string,
  ) {
    const now = new Date();
    const bogotaNow = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const selectedQuarter =
      quarter ?? Math.floor(bogotaNow.getUTCMonth() / 3) + 1;
    const defaultPeriod = this.currentBogotaWeek(now);
    const periodStart = periodFrom
      ? new Date(`${periodFrom.slice(0, 10)}T05:00:00.000Z`)
      : defaultPeriod.start;
    const periodEnd = periodTo
      ? new Date(
          new Date(`${periodTo.slice(0, 10)}T05:00:00.000Z`).getTime() +
            24 * 60 * 60 * 1000,
        )
      : defaultPeriod.end;
    const quarterStart = new Date(
      Date.UTC(bogotaNow.getUTCFullYear(), (selectedQuarter - 1) * 3, 1, 5),
    );
    const quarterEnd = new Date(
      Date.UTC(bogotaNow.getUTCFullYear(), selectedQuarter * 3, 1, 5),
    );
    return { periodStart, periodEnd, quarterStart, quarterEnd, selectedQuarter };
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

  private async averageLeadToOuvDays(): Promise<number | null> {
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
      `,
      {
        type: QueryTypes.SELECT,
        replacements: { origenVia: OuvOrigenVia.DesdeSql },
      },
    );
    if (row?.avg_days == null) {
      return null;
    }
    return Number(Number(row.avg_days).toFixed(1));
  }

  /** Monday 00:00 through next Monday 00:00 in America/Bogota (UTC-5). */
  private currentBogotaWeek(now: Date): { start: Date; end: Date } {
    const bogotaOffsetMs = 5 * 60 * 60 * 1000;
    const local = new Date(now.getTime() - bogotaOffsetMs);
    const daysSinceMonday = (local.getUTCDay() + 6) % 7;
    const startLocal = Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() - daysSinceMonday,
    );
    const start = new Date(startLocal + bogotaOffsetMs);
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { start, end };
  }
}
