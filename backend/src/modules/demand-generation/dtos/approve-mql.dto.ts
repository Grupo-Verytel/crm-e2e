import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CitaContactoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  telefono!: string;
}

export class ApproveMqlDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comentario?: string;

  /** Required for GENERACION_DEMANDA_AGENCIA; optional proposed meeting for other canals. */
  @IsOptional()
  @IsDateString()
  fecha_cita?: string;

  /** Required for GENERACION_DEMANDA_AGENCIA; optional proposed meeting for other canals. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => CitaContactoDto)
  cita_contactos?: CitaContactoDto[];

  /** Fallback when cita_contactos is omitted (single primary contact). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cita_contacto_nombre?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  cita_contacto_email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  cita_contacto_telefono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cita_lugar?: string;
}
