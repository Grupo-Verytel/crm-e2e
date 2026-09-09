import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

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
  @IsString()
  @MaxLength(120)
  cita_contacto_nombre?: string;

  /** Required when the lead canal is GENERACION_DEMANDA_AGENCIA. */
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  cita_contacto_email?: string;

  /** Required when the lead canal is GENERACION_DEMANDA_AGENCIA. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  cita_contacto_telefono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cita_lugar?: string;
}
