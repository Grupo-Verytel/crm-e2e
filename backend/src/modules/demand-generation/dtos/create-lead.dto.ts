import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { OrigenLead, TipoLead } from '../models/enums/lead.enums';
import { Segmento } from '../models/enums/segment.enum';

export class CreateLeadDto {
  @IsEnum(TipoLead)
  tipo_lead: TipoLead;

  @IsEnum(OrigenLead)
  origen: OrigenLead;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sub_origen?: string;

  @IsOptional()
  @IsUUID('4')
  campana_id?: string;

  @IsEnum(Segmento)
  segmento: Segmento;

  @ValidateIf((dto: CreateLeadDto) => dto.segmento === Segmento.B2B)
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  industria?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  region: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2)
  pais: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  empresa_nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  nit?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  contacto_nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  cargo?: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @IsUUID('4')
  responsable_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utm_source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utm_medium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utm_campaign?: string;
}
