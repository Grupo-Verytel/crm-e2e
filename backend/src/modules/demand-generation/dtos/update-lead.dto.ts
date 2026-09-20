import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { OrigenLead, TipoLead } from '../models/enums/lead.enums';
import { Segmento } from '../models/enums/segment.enum';
import { resolveSegmentoFromInput } from '../lib/segment-catalog';

export class UpdateLeadDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsEnum(TipoLead)
  tipo_lead?: TipoLead;

  @Transform(({ value }) =>
    value === 'Email' ? OrigenLead.EmailMarketing : value,
  )
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

  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  })
  @IsOptional()
  @IsUUID()
  account_id?: string;

  @Transform(({ value }) => resolveSegmentoFromInput(value))
  @IsOptional()
  @IsEnum(Segmento)
  segmento?: Segmento;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  industria?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

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
  @MaxLength(20)
  nit?: string | null;

  @IsOptional()
  @IsUUID('4')
  segment_id?: string | null;

  @IsOptional()
  @IsUUID('4')
  subsegment_id?: string | null;

  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referrer_name?: string | null;

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
