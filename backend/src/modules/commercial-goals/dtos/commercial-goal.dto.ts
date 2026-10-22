import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

const AMOUNT_MESSAGE = 'La meta debe ser un entero en pesos, mayor que cero.';
const YEAR_MESSAGE = 'El año fiscal debe estar entre 2020 y 2100.';
const QUARTER_MESSAGE = 'El trimestre debe estar entre 1 y 4.';

export class CreateCommercialGoalDto {
  @IsUUID('all', { message: 'El comercial no es válido.' })
  user_id!: string;

  @Type(() => Number)
  @IsInt({ message: YEAR_MESSAGE })
  @Min(2020, { message: YEAR_MESSAGE })
  @Max(2100, { message: YEAR_MESSAGE })
  fiscal_year!: number;

  @Type(() => Number)
  @IsInt({ message: QUARTER_MESSAGE })
  @Min(1, { message: QUARTER_MESSAGE })
  @Max(4, { message: QUARTER_MESSAGE })
  quarter!: number;

  @IsUUID('all', { message: 'El segmento no es válido.' })
  segment_id!: string;

  @Type(() => Number)
  @IsInt({ message: AMOUNT_MESSAGE })
  @Min(1, { message: AMOUNT_MESSAGE })
  @Max(Number.MAX_SAFE_INTEGER, { message: AMOUNT_MESSAGE })
  amount_cop!: number;
}

export class UpdateCommercialGoalDto {
  @IsOptional()
  @IsUUID('all', { message: 'El comercial no es válido.' })
  user_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: YEAR_MESSAGE })
  @Min(2020, { message: YEAR_MESSAGE })
  @Max(2100, { message: YEAR_MESSAGE })
  fiscal_year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: QUARTER_MESSAGE })
  @Min(1, { message: QUARTER_MESSAGE })
  @Max(4, { message: QUARTER_MESSAGE })
  quarter?: number;

  @IsOptional()
  @IsUUID('all', { message: 'El segmento no es válido.' })
  segment_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: AMOUNT_MESSAGE })
  @Min(1, { message: AMOUNT_MESSAGE })
  @Max(Number.MAX_SAFE_INTEGER, { message: AMOUNT_MESSAGE })
  amount_cop?: number;
}

export class ListCommercialGoalsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: YEAR_MESSAGE })
  @Min(2020, { message: YEAR_MESSAGE })
  @Max(2100, { message: YEAR_MESSAGE })
  fiscal_year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: QUARTER_MESSAGE })
  @Min(1, { message: QUARTER_MESSAGE })
  @Max(4, { message: QUARTER_MESSAGE })
  quarter?: number;

  @IsOptional()
  @IsUUID('all')
  user_id?: string;

  @IsOptional()
  @IsUUID('all')
  segment_id?: string;
}

export class CommercialGoalSummaryQueryDto {
  @Type(() => Number)
  @IsInt({ message: YEAR_MESSAGE })
  @Min(2020, { message: YEAR_MESSAGE })
  @Max(2100, { message: YEAR_MESSAGE })
  fiscal_year!: number;

  @IsOptional()
  @IsUUID('all')
  user_id?: string;

  @IsOptional()
  @IsUUID('all')
  segment_id?: string;
}

export class CommercialGoalResponseDto {
  commercial_goal_id!: string;
  user_id!: string;
  commercial_full_name!: string;
  commercial_role_name!: string;
  fiscal_year!: number;
  quarter!: number;
  segment_id!: string;
  segment_name!: string;
  amount_cop!: string;
  created_at!: Date;
  updated_at!: Date;
}

export class PaginatedCommercialGoalsResponseDto {
  items!: CommercialGoalResponseDto[];
  total!: number;
  page!: number;
  limit!: number;
}

export class CommercialGoalQuarterSummaryDto {
  quarter!: number;
  total_amount_cop!: string;
  commercial_count!: number;
}

export class CommercialGoalSummaryResponseDto {
  fiscal_year!: number;
  quarters!: CommercialGoalQuarterSummaryDto[];
}

export class DeleteCommercialGoalResponseDto {
  deleted!: true;
}
