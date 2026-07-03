import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { LeadEstado } from '../models/enums/lead.enums';
import { Segmento } from '../models/enums/segment.enum';

export class LeadsQueryDto {
  @IsOptional()
  @IsEnum(LeadEstado)
  estado?: LeadEstado;

  @IsOptional()
  @IsEnum(Segmento)
  segmento?: Segmento;

  @IsOptional()
  @IsUUID('4')
  responsable_id?: string;

  @IsOptional()
  @IsUUID('4')
  campana_id?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class LeadResponseDto {
  lead_id: string;
  tipo_lead: string;
  origen: string;
  sub_origen: string | null;
  campana_id: string | null;
  segmento: string;
  industria: string | null;
  region: string;
  pais: string;
  empresa_nombre: string;
  nit: string | null;
  contacto_nombre: string;
  cargo: string | null;
  email: string;
  telefono: string | null;
  tipo_influencia: string | null;
  estado: string;
  icp_score: number | null;
  responsable_id: string;
  motivo_descarte: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  fecha_captura: Date;
  fecha_ultima_interaccion: Date | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export class PaginatedLeadsResponseDto {
  items: LeadResponseDto[];
  total: number;
  page: number;
  limit: number;
}
