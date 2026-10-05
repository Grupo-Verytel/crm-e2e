import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

function toOptionalInt({ value }: { value: unknown }): number | undefined {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

export class QualificationDashboardQueryDto {
  @IsOptional()
  @Transform(toOptionalInt)
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
  @Transform(toOptionalInt)
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

export class QualificationDashboardPeriodDto {
  active!: boolean;
  period_from!: string | null;
  period_to!: string | null;
  year!: number | null;
  quarter!: number | null;
}

export class QualificationCitasCalificacionDto {
  scheduled_by_commercial!: number;
  executed!: number;
  /** SQL entregados al comercial (fecha_asignacion) en el periodo. */
  sql_assigned_in_period!: number;
  /** De esos, convertidos a OUV por el comercial. */
  sql_converted_to_ouv_in_period!: number;
  sql_to_ouv_conversion_rate!: number | null;
}

/** Monetary OUV metric: SUM of the applicable amount + matching count. */
export class QualificationOuvValueMetricDto {
  amount!: number;
  count!: number;
}

export class QualificationPipelineOpenZonasDto {
  universo!: QualificationOuvValueMetricDto;
  encima_funnel!: QualificationOuvValueMetricDto;
  en_funnel!: QualificationOuvValueMetricDto;
  mayor_probabilidad!: QualificationOuvValueMetricDto;
}

export class QualificationPipelineDto {
  /** EnCurso OUVs, SUM(presupuesto_monto) by zona. Snapshot, not period-filtered. */
  open_zonas!: QualificationPipelineOpenZonasDto;
  ouvs_won_in_period!: QualificationOuvValueMetricDto;
  ouvs_lost_in_period!: QualificationOuvValueMetricDto;
  ouvs_discarded_in_period!: QualificationOuvValueMetricDto;
}

export class QualificationMqlBandejaDto {
  /** MQL Activo en bandeja de mercadeo (pendiente aprobación Soporte). */
  pending_total!: number;
  /** Lead del MQL sin fecha_cita. */
  without_cita!: number;
  /** Lead del MQL con fecha_cita. */
  with_cita!: number;
}

export class QualificationDashboardResponseDto {
  period!: QualificationDashboardPeriodDto;
  mql_bandeja!: QualificationMqlBandejaDto;
  citas_calificacion!: QualificationCitasCalificacionDto;
  pipeline!: QualificationPipelineDto;
}
