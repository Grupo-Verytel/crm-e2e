import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { LeadEstado } from '../models/enums/lead.enums';

export class MarketingDashboardQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  quarter?: number;

  @IsOptional()
  @IsDateString()
  period_from?: string;

  @IsOptional()
  @IsDateString()
  period_to?: string;
}

export class LeadsBySegmentDto {
  segmento: string;
  count: number;
}

export class FunnelStageDto {
  estado: string;
  count: number;
}

export class WeeklyMarketingMetricsDto {
  interactions: number;
  new_leads: number;
  quarter_leads: number;
  quarter: number;
  leads_by_channel: LeadsByChannelDto[];
  interactions_by_channel: LeadsByChannelDto[];
  quarter_leads_by_channel: LeadsByChannelDto[];
  converted_ouvs: number;
}

export type MarketingDashboardDetailKind =
  | 'interactions'
  | 'period_leads'
  | 'quarter_leads'
  | 'ouvs'
  | 'funnel';

export class MarketingDashboardDetailsQueryDto {
  @IsIn(['interactions', 'period_leads', 'quarter_leads', 'ouvs', 'funnel'])
  kind!: MarketingDashboardDetailKind;

  @IsOptional()
  @IsEnum(LeadEstado)
  estado?: LeadEstado;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  quarter?: number;

  @IsOptional()
  @IsDateString()
  period_from?: string;

  @IsOptional()
  @IsDateString()
  period_to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class MarketingDashboardDetailItemDto {
  entity: 'lead' | 'ouv';
  id: string;
  interaction_id: string | null;
  empresa: string | null;
  segmento: string | null;
  origen: string | null;
  canal_origen: string | null;
  tipo_comunicacion: string | null;
  canal: string | null;
  consecutivo: string | null;
  estado: string | null;
  created_at: Date | string | null;
  dias_transcurridos: number | null;
}

export class MarketingDashboardDetailsResponseDto {
  kind: MarketingDashboardDetailKind;
  items: MarketingDashboardDetailItemDto[];
  total: number;
  page: number;
  limit: number;
}

export class LeadsByChannelDto {
  canal_origen: string;
  count: number;
}

export class MarketingDashboardResponseDto {
  total_leads: number;
  leads_by_segment: LeadsBySegmentDto[];
  qualified_rate: number;
  average_cpl: number | null;
  pending_mqls: number;
  funnel: FunnelStageDto[];
  average_conversion_days: number | null;
  weekly: WeeklyMarketingMetricsDto;
}
