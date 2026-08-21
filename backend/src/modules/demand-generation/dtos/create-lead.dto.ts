import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import {
  CanalOrigen,
  OrigenLead,
  TipoLead,
} from '../models/enums/lead.enums';
import { Segmento } from '../models/enums/segment.enum';
import {
  DirectChecklistDto,
  LeadContactInputDto,
} from './lead-contact.dto';

export class CreateLeadDto {
  @IsEnum(TipoLead)
  tipo_lead: TipoLead;

  @IsEnum(OrigenLead)
  origen: OrigenLead;

  @IsEnum(CanalOrigen)
  canal_origen: CanalOrigen;

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

  @IsOptional()
  @IsUUID('4')
  segment_id?: string;

  @IsOptional()
  @IsUUID('4')
  subsegment_id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  region: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2)
  pais: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  nit?: string;

  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => LeadContactInputDto)
  contacts: LeadContactInputDto[];

  @IsUUID('4')
  responsable_id: string;

  @ValidateIf(
    (dto: CreateLeadDto) => dto.canal_origen === CanalOrigen.TraductorNegocio,
  )
  @IsUUID('4')
  business_referrer_id?: string;

  /** Required for ProductManager / EjecutivoComercial direct routes. */
  @IsOptional()
  @ValidateNested()
  @Type(() => DirectChecklistDto)
  checklist?: DirectChecklistDto;

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
