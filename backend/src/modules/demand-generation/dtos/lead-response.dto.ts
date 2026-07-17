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
import { CanalOrigen, LeadEstado } from '../models/enums/lead.enums';
import { Segmento } from '../models/enums/segment.enum';
import { LeadContactResponseDto } from './lead-contact.dto';

export class LeadsQueryDto {
  @IsOptional()
  @IsEnum(LeadEstado)
  estado?: LeadEstado;

  @IsOptional()
  @IsEnum(Segmento)
  segmento?: Segmento;

  @IsOptional()
  @IsEnum(CanalOrigen)
  canal_origen?: CanalOrigen;

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
  canal_origen: CanalOrigen;
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
  contacts: LeadContactResponseDto[];
  tipo_influencia: string | null;
  estado: string;
  icp_score: number | null;
  responsable_id: string;
  responsable_nombre: string | null;
  cita_agendada: boolean;
  fecha_cita: Date | null;
  comercial_asignado_id: string | null;
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
