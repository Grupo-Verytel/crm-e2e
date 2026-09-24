import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReminderDto {
  @IsDateString()
  event_at: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  remind_days_before: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
