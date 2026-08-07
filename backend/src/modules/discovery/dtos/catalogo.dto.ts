import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OuvZona } from '../models/enums/ouv.enums';

export class CrearMotivoCatalogoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombre!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requiere_detalle?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  orden?: number;
}

export class ActualizarMotivoCatalogoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string | null;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requiere_detalle?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  orden?: number;
}

export class CrearZonaChecklistTemplateDto {
  @IsEnum(OuvZona)
  zona!: OuvZona;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  codigo_item!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  orden?: number;
}

export class ActualizarZonaChecklistTemplateDto {
  @IsOptional()
  @IsEnum(OuvZona)
  zona?: OuvZona;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  codigo_item?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  orden?: number;
}

export class MotivoCatalogoResponseDto {
  motivo_id!: string;
  nombre!: string;
  descripcion!: string | null;
  requiere_detalle!: boolean;
  orden!: number;
  created_at!: Date;
  updated_at!: Date;
}

export class ZonaChecklistTemplateResponseDto {
  template_id!: string;
  zona!: string;
  codigo_item!: string;
  label!: string;
  orden!: number;
  created_at!: Date;
  updated_at!: Date;
}
