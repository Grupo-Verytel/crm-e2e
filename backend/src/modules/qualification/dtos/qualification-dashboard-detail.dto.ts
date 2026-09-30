import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export const QUALIFICATION_DASHBOARD_DETAIL_KINDS = [
  'mql_bandeja',
  'mql_with_cita',
  'citas_scheduled',
  'citas_executed',
  'sql_converted_ouv',
  'ouvs_ready_offer',
  'ouvs_won',
] as const;

export type QualificationDashboardDetailKind =
  (typeof QUALIFICATION_DASHBOARD_DETAIL_KINDS)[number];

export class QualificationDashboardDetailsQueryDto {
  @IsIn([...QUALIFICATION_DASHBOARD_DETAIL_KINDS])
  kind!: QualificationDashboardDetailKind;

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
  @Min(2000)
  @Max(2100)
  year?: number;

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

export class QualificationDashboardDetailItemDto {
  entity!: 'lead' | 'sql' | 'ouv' | 'cita';
  id!: string;
  label!: string;
  segmento!: string | null;
  estado!: string | null;
  detail!: string | null;
  occurred_at!: string | null;
  /** When set, Calificación UI links to `/qualification/sqls/:id`. */
  sql_id!: string | null;
}

export class QualificationDashboardDetailsResponseDto {
  kind!: QualificationDashboardDetailKind;
  items!: QualificationDashboardDetailItemDto[];
  total!: number;
  page!: number;
  limit!: number;
}
