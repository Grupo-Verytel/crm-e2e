import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { AuditAction } from '../models/audit-action.enum';

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
