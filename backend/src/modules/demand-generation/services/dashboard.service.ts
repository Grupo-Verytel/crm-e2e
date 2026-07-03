import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { col, fn, Op, WhereOptions } from 'sequelize';
import {
  FunnelStageDto,
  LeadsBySegmentDto,
  MarketingDashboardQueryDto,
  MarketingDashboardResponseDto,
} from '../dtos/dashboard-response.dto';
import { ChecklistResultado } from '../models/enums/checklist.enums';
import { LeadEstado } from '../models/enums/lead.enums';
import { MqlEstado } from '../models/enums/mql.enums';
import { Campaign } from '../models/campaign.model';
import { Lead } from '../models/lead.model';
import { LeadChecklist } from '../models/lead-checklist.model';
import { Mql } from '../models/mql.model';

const FUNNEL_ORDER: LeadEstado[] = [
  LeadEstado.TOFU,
  LeadEstado.MOFU,
  LeadEstado.MqlPending,
  LeadEstado.SQL,
];

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Lead) private readonly leadModel: typeof Lead,
    @InjectModel(LeadChecklist)
    private readonly checklistModel: typeof LeadChecklist,
    @InjectModel(Mql) private readonly mqlModel: typeof Mql,
    @InjectModel(Campaign) private readonly campaignModel: typeof Campaign,
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
    ] = await Promise.all([
      this.leadModel.count({ where: leadWhere }),
      this.countLeadsBySegment(leadWhere),
      this.countQualifiedLeads(),
      this.mqlModel.count({ where: { estado: MqlEstado.Activo } }),
      this.buildFunnel(leadWhere),
      this.averageCpl(),
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
}
