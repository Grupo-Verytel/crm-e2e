import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsEnum } from 'class-validator';
import { PresupuestoMoneda } from '../models/enums/ouv.enums';

export class GanarOuvDto {
  @IsOptional()
  @IsString()
  motivo_id?: string;

  @IsOptional()
  @IsString()
  motivo_detalle?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monto_final!: number;

  @IsEnum(PresupuestoMoneda)
  moneda_final!: PresupuestoMoneda;
}

export class PerderOuvDto {
  @IsString()
  @IsNotEmpty()
  motivo_id!: string;

  @IsOptional()
  @IsString()
  motivo_detalle?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monto_estimado_perdido!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  competidor_ganador?: string;
}

export class DescartarOuvDto {
  @IsString()
  @IsNotEmpty()
  motivo_id!: string;

  @IsOptional()
  @IsString()
  motivo_detalle?: string;
}

export class RetrocederOuvDto {
  @IsString()
  @IsNotEmpty()
  motivo!: string;
}
