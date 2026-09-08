import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  OuvResultado,
  OuvZona,
} from '../models/enums/ouv.enums';

function queryBoolean({ value }: { value: unknown }): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === true || value === 'true' || value === '1') {
    return true;
  }
  if (value === false || value === 'false' || value === '0') {
    return false;
  }
  return undefined;
}

export class ListarOuvsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(OuvZona)
  zona?: OuvZona;

  @IsOptional()
  @IsEnum(OuvResultado)
  resultado?: OuvResultado;

  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  tiene_gap?: boolean;

  /** Free-text search over titulo / empresa_nombre / consecutivo. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsDateString()
  created_from?: string;

  @IsOptional()
  @IsDateString()
  created_to?: string;

  /** When true, list all OUVs for follow-up roles. Default: only own. */
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  all?: boolean;
}
