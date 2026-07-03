import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { CampaignEstado, CampaignTipo } from '../models/enums/campaign.enums';

export class CampaignsQueryDto {
  @IsOptional()
  @IsEnum(CampaignEstado)
  estado?: CampaignEstado;

  @IsOptional()
  @IsEnum(CampaignTipo)
  tipo?: CampaignTipo;

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

export class CampaignResponseDto {
  campana_id: string;
  nombre: string;
  tipo: string;
  canal: string;
  objetivo: string;
  segmento_objetivo: string;
  responsable_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  presupuesto: string | null;
  gasto_real: string | null;
  estado: string;
  leads_generados: number;
  cpl: string | null;
  created_at: Date;
  updated_at: Date;
}

export class PaginatedCampaignsResponseDto {
  items: CampaignResponseDto[];
  total: number;
  page: number;
  limit: number;
}
