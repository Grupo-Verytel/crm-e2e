import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class QualificationDashboardQueryDto {
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

export class QualificationPipelineDto {
  ouvs_ready_for_offer_closing!: number;
  ouvs_won_in_period!: number;
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
