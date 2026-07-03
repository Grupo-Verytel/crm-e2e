import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { OrigenLead, TipoLead } from '../models/enums/lead.enums';
import { Segmento } from '../models/enums/segment.enum';

export class UpdateLeadDto {
  @IsOptional()
  @IsEnum(TipoLead)
  tipo_lead?: TipoLead;

  @IsOptional()
  @IsEnum(OrigenLead)
  origen?: OrigenLead;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sub_origen?: string;

  @IsOptional()
  @IsUUID('4')
  campana_id?: string | null;

  @IsOptional()
  @IsEnum(Segmento)
  segmento?: Segmento;

  @ValidateIf((dto: UpdateLeadDto) => dto.segmento === Segmento.B2B)
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  industria?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  region?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  pais?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  empresa_nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  nit?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contacto_nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  cargo?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string | null;

  @IsOptional()
  @IsUUID('4')
  responsable_id?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  icp_score?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utm_source?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utm_medium?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utm_campaign?: string | null;
}
