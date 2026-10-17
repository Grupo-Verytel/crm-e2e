import { OmitType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** Optional follow-up created in the same transaction as the OUV interaction. */
export class RecordatorioOuvDto {
  @IsDateString()
  event_at!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  remind_days_before?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Alta de una interacción. El hilo usa `ResponderOuvInteraccionDto`. */
export class CrearOuvInteraccionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titulo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  observaciones?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => RecordatorioOuvDto)
  recordatorio?: RecordatorioOuvDto;
}

/** Reply on a thread. `recordatorio` is not a property, so the whitelist rejects it. */
export class ResponderOuvInteraccionDto extends OmitType(
  CrearOuvInteraccionDto,
  ['recordatorio'] as const,
) {}
