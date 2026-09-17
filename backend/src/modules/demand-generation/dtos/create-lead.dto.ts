import { Type, Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsEnum,
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
import { resolveSegmentoFromInput } from '../lib/segment-catalog';
import {
  DirectChecklistDto,
  LeadContactInputDto,
} from './lead-contact.dto';

function normalizeOrigenLead(value: unknown): unknown {
  return value === 'Email' ? OrigenLead.EmailMarketing : value;
}

export class CreateLeadDto {
  /** Optional: generated from the account name when omitted. */
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsEnum(TipoLead)
  tipo_lead?: TipoLead;

  @Transform(({ value }) => normalizeOrigenLead(value))
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

  @Transform(({ value }) => resolveSegmentoFromInput(value))
  @IsEnum(Segmento)
  segmento: Segmento;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  industria?: string;

  @IsOptional()
  @IsUUID('4')
  segment_id?: string;

  @ValidateIf(
    (dto: CreateLeadDto) =>
      dto.segmento === Segmento.Industria || Boolean(dto.subsegment_id),
  )
  @IsUUID('4')
  subsegment_id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  city: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  region: string;

  /** Defaults to CO when omitted (Colombia city/region picker). */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  pais?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  nit?: string;

  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LeadContactInputDto)
  contacts: LeadContactInputDto[];

  @IsUUID('4')
  responsable_id: string;

  @Transform(({ value }) => (value === '' ? undefined : value))
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
