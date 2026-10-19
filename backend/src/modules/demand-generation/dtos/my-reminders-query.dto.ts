import { Transform, Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { REMINDER_GROUPS } from '../lib/reminder-group';

function toGroupList({ value }: { value: unknown }): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parts = Array.isArray(value) ? value : String(value).split(',');
  const groups = parts.map((part) => String(part).trim()).filter(Boolean);
  return groups.length > 0 ? groups : undefined;
}

export class MyRemindersQueryDto {
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
  @Transform(toGroupList)
  @IsArray()
  @IsIn(REMINDER_GROUPS, { each: true })
  group?: Array<(typeof REMINDER_GROUPS)[number]>;
}
