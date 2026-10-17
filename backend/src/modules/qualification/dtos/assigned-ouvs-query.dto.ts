import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { FOLLOW_UP_STATUSES } from '../lib/follow-up-status';

function toStatusList({ value }: { value: unknown }): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parts = Array.isArray(value) ? value : String(value).split(',');
  const statuses = parts.map((part) => String(part).trim()).filter(Boolean);
  return statuses.length > 0 ? statuses : undefined;
}

export class AssignedOuvsQueryDto {
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

  @IsOptional()
  @IsUUID('4')
  comercial_id?: string;

  @IsOptional()
  @Transform(toStatusList)
  @IsArray()
  @IsIn(FOLLOW_UP_STATUSES, { each: true })
  follow_up_status?: Array<(typeof FOLLOW_UP_STATUSES)[number]>;

  /** Consecutivo, client name (`empresa_nombre`) or title. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
