import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class SqlsQueryDto {
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

export class SqlCitaResponseDto {
  cita_id: string;
  sql_id: string;
  lugar: string;
  fecha: string;
  hora: string;
  contacto_nombre: string;
  contacto_cargo: string | null;
  descripcion: string | null;
  agendada_por: string;
  created_at: Date;
  updated_at: Date;
}

export class SqlDetailDto {
  sql_id: string;
  mql_id: string;
  estado: string;
  en_backlog: boolean;
  comercial_asignado_id: string | null;
  fecha_asignacion: Date | null;
  fecha_creacion: Date;
  lead: Record<string, unknown>;
  interactions: unknown[];
  cita: SqlCitaResponseDto | null;
}

export class PaginatedSqlsResponseDto {
  items: SqlDetailDto[];
  total: number;
  page: number;
  limit: number;
}

export class AssignSqlResponseDto {
  sql: SqlDetailDto;
  cita: SqlCitaResponseDto | null;
}
