import { IsEnum, IsOptional, ValidateIf } from 'class-validator';
import { SqlCitaEstado } from '../models/enums/sql-cita-estado.enum';

export class UpdateMeetingStatusDto {
  /** Null clears manual status (Sin agendar). */
  @IsOptional()
  @ValidateIf((_obj, value) => value !== null && value !== undefined)
  @IsEnum(SqlCitaEstado)
  estado?: SqlCitaEstado | null;
}
