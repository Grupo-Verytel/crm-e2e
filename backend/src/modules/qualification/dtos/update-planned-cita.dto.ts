import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class UpdatePlannedCitaDto {
  @IsDateString()
  fecha_cita!: string;

  @IsOptional()
  @IsUUID()
  comercial_asignado_id?: string;
}
