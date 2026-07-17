import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { MqlEstado } from '../models/enums/mql.enums';

export class MqlsQueryDto {
  @IsOptional()
  @IsEnum(MqlEstado)
  estado?: MqlEstado;

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

export class MqlResponseDto {
  mql_id: string;
  lead_id: string;
  checklist_id: string | null;
  calificado_por: string;
  fecha_calificacion: Date;
  motivo_calificacion: string | null;
  estado: string;
  created_at: Date;
  updated_at: Date;
}

export class PaginatedMqlsResponseDto {
  items: MqlResponseDto[];
  total: number;
  page: number;
  limit: number;
}

export class SqlResponseDto {
  sql_id: string;
  mql_id: string;
  en_backlog: boolean;
  comercial_asignado_id: string | null;
  fecha_creacion: Date;
}

export class ApproveMqlResponseDto {
  mql: MqlResponseDto;
  sql: SqlResponseDto;
}
