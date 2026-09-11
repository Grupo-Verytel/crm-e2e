import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { AuditAction } from '../models/audit-action.enum';

export const AUDIT_SORT_FIELDS = [
  'timestamp',
  'accion',
  'tabla',
  'registro_id',
  'campo_modificado',
  'actor',
  'ip_address',
] as const;

export type AuditSortField = (typeof AUDIT_SORT_FIELDS)[number];

export const AUDIT_SORT_DIRECTIONS = ['ASC', 'DESC'] as const;

export type AuditSortDirection = (typeof AUDIT_SORT_DIRECTIONS)[number];

export class AuditLogQueryDto {
  @IsOptional()
  @IsString()
  tabla?: string;

  @IsOptional()
  @IsUUID('4')
  registro_id?: string;

  @IsOptional()
  @IsUUID('4')
  usuario_id?: string;

  @IsOptional()
  @IsEnum(AuditAction)
  accion?: AuditAction;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(AUDIT_SORT_FIELDS)
  sort_by?: AuditSortField;

  @IsOptional()
  @IsIn(AUDIT_SORT_DIRECTIONS)
  sort_dir?: AuditSortDirection;

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
