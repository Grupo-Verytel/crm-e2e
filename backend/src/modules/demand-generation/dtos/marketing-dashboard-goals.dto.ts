import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { MarketingDashboardMetric } from '../models/enums/marketing-dashboard-metric.enum';

export const WEEKLY_TARGET_MESSAGE =
  'La meta semanal debe ser un entero entre 0 y 2147483647.';
export const QUARTER_MESSAGE = 'El trimestre debe estar entre 1 y 4.';
export const FISCAL_YEAR_MESSAGE =
  'El año fiscal debe estar entre 2000 y 2100.';
export const METRIC_MESSAGE = 'La métrica no es válida.';

export class MarketingGoalInputDto {
  @IsEnum(MarketingDashboardMetric, { message: METRIC_MESSAGE })
  metric: MarketingDashboardMetric;

  @Type(() => Number)
  @IsInt({ message: WEEKLY_TARGET_MESSAGE })
  @Min(0, { message: WEEKLY_TARGET_MESSAGE })
  @Max(2147483647, { message: WEEKLY_TARGET_MESSAGE })
  weekly_target: number;
}

export class ReplaceMarketingDashboardGoalsDto {
  @Type(() => Number)
  @IsInt({ message: FISCAL_YEAR_MESSAGE })
  @Min(2000, { message: FISCAL_YEAR_MESSAGE })
  @Max(2100, { message: FISCAL_YEAR_MESSAGE })
  fiscal_year: number;

  @Type(() => Number)
  @IsInt({ message: QUARTER_MESSAGE })
  @Min(1, { message: QUARTER_MESSAGE })
  @Max(4, { message: QUARTER_MESSAGE })
  quarter: number;

  @IsArray({ message: METRIC_MESSAGE })
  @ArrayMinSize(3, { message: METRIC_MESSAGE })
  @ArrayMaxSize(3, { message: METRIC_MESSAGE })
  @ValidateNested({ each: true })
  @Type(() => MarketingGoalInputDto)
  goals: MarketingGoalInputDto[];
}

export class ListMarketingDashboardGoalsQueryDto {
  @Type(() => Number)
  @IsInt({ message: FISCAL_YEAR_MESSAGE })
  @Min(2000, { message: FISCAL_YEAR_MESSAGE })
  @Max(2100, { message: FISCAL_YEAR_MESSAGE })
  year: number;
}

export class MarketingDashboardTargetResponseDto {
  target_id: string;
  fiscal_year: number;
  quarter: number;
  metric: MarketingDashboardMetric;
  weekly_target: number;
  created_at: string;
  updated_at: string;
}

export class ListMarketingDashboardGoalsResponseDto {
  fiscal_year: number;
  quarters: Array<{ quarter: number; days: number }>;
  items: MarketingDashboardTargetResponseDto[];
}

export class ReplaceMarketingDashboardGoalsResponseDto {
  fiscal_year: number;
  quarter: number;
  items: MarketingDashboardTargetResponseDto[];
}

export class DeleteMarketingDashboardGoalResponseDto {
  deleted: true;
}
