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
import { Type } from 'class-transformer';
import {
  OuvResultado,
  OuvZona,
} from '../models/enums/ouv.enums';

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
  @Type(() => Boolean)
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

  /** When true, list all OUVs (SoporteComercial). Default: only own. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  all?: boolean;
}
