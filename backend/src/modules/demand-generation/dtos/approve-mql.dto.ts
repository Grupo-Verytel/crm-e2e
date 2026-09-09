import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ApproveMqlDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comentario?: string;

  /** Required when the lead canal is GENERACION_DEMANDA_AGENCIA. */
  @IsOptional()
  @IsDateString()
  fecha_cita?: string;

  /** Required when the lead canal is GENERACION_DEMANDA_AGENCIA. */
  @IsOptional()
  @IsUUID('4')
  comercial_asignado_id?: string;
}
