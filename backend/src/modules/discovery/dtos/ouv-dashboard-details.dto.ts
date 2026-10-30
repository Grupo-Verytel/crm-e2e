import { Transform, Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { OUV_DASHBOARD_DETAIL_KINDS } from '../lib/ouv-dashboard-metrics';
import type { OuvDashboardDetailKind } from '../lib/ouv-dashboard-metrics';
import { OuvZona } from '../models/enums/ouv.enums';
import { OuvDashboardQueryDto } from './ouv-dashboard.dto';

function toOptionalInt({ value }: { value: unknown }): number | undefined {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

export class OuvDashboardDetailsQueryDto extends OuvDashboardQueryDto {
  @IsIn([...OUV_DASHBOARD_DETAIL_KINDS])
  kind!: OuvDashboardDetailKind;

  @IsOptional()
  @IsEnum(OuvZona)
  zona?: OuvZona;

  @IsOptional()
  @Transform(toOptionalInt)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(toOptionalInt)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
