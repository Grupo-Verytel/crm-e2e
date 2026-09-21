import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsArray,
  Min,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { MarketingDashboardPeriodType } from '../models/enums/marketing-dashboard-period-type.enum';

export class MarketingDashboardTargetRowDto {
  @IsEnum(MarketingDashboardPeriodType)
  period_type!: MarketingDashboardPeriodType;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  interactions!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  period_leads!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  converted_ouvs!: number;
}

export class UpdateMarketingDashboardTargetsDto {
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => MarketingDashboardTargetRowDto)
  targets!: MarketingDashboardTargetRowDto[];
}

export class MarketingDashboardTargetsResponseDto {
  targets!: MarketingDashboardTargetRowDto[];
}
