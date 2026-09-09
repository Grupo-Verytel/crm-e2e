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
  IsUUID,
  Matches,
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

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => CitaContactoDto)
  contactos?: CitaContactoDto[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  contacto_nombre!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  contacto_email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contacto_telefono?: string;

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
