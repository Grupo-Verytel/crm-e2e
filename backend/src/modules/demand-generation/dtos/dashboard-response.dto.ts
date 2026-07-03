import { IsDateString, IsOptional } from 'class-validator';

export class MarketingDashboardQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class LeadsBySegmentDto {
  segmento: string;
  count: number;
}

export class FunnelStageDto {
  estado: string;
  count: number;
}

export class MarketingDashboardResponseDto {
  total_leads: number;
  leads_by_segment: LeadsBySegmentDto[];
  qualified_rate: number;
  average_cpl: number | null;
  pending_mqls: number;
  funnel: FunnelStageDto[];
}
