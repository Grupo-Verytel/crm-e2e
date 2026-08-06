import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateSqlCitaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  lugar!: string;

  @IsDateString()
  fecha!: string;

  /** HH:mm or HH:mm:ss */
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  hora!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  contacto_nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contacto_cargo?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;
}

export class AssignSqlDto {
  @IsUUID()
  comercial_asignado_id!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateSqlCitaDto)
  cita?: CreateSqlCitaDto;
}

export class UpdateSqlCitaDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  lugar?: string;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  hora?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  contacto_nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contacto_cargo?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;
}
