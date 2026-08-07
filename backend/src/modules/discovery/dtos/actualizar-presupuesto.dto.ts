import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PresupuestoFuente,
  PresupuestoMoneda,
} from '../models/enums/ouv.enums';

export class ActualizarPresupuestoDto {
  @IsBoolean()
  presupuesto_confirmado!: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  presupuesto_monto?: number | null;

  @IsOptional()
  @IsEnum(PresupuestoMoneda)
  presupuesto_moneda?: PresupuestoMoneda | null;

  @IsOptional()
  @IsDateString()
  presupuesto_fecha_captura?: string | null;

  @IsOptional()
  @IsEnum(PresupuestoFuente)
  presupuesto_fuente?: PresupuestoFuente | null;
}
