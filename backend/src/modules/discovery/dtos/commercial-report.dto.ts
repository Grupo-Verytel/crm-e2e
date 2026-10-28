import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { COMMERCIAL_REPORT_KINDS } from '../lib/commercial-report-metrics';
import type {
  CommercialReportKind,
  CommercialReportName,
} from '../lib/commercial-report-metrics';
import { OuvResultado, OuvSegmento } from '../models/enums/ouv.enums';

function toOptionalInt({ value }: { value: unknown }): number | undefined {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

export class CommercialReportQueryDto {
  @IsOptional()
  @Transform(toOptionalInt)
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  quarter?: number;

  @IsOptional()
  @IsDateString()
  period_from?: string;

  @IsOptional()
  @IsDateString()
  period_to?: string;

  @IsOptional()
  @IsUUID('4')
  comercial_id?: string;

  @IsOptional()
  @IsEnum(OuvSegmento)
  segmento?: OuvSegmento;

  @IsOptional()
  @IsDateString()
  fecha_corte?: string;
}

export class PipelineHealthQueryDto {
  @IsOptional()
  @IsUUID('4')
  comercial_id?: string;

  @IsOptional()
  @IsEnum(OuvSegmento)
  segmento?: OuvSegmento;
}

export class CommercialReportDetailsQueryDto extends CommercialReportQueryDto {
  @IsIn(['committee', 'pipeline-health'])
  report!: CommercialReportName;

  @IsIn([...COMMERCIAL_REPORT_KINDS])
  kind!: CommercialReportKind;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  from_estado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  to_estado?: string;

  @IsOptional()
  @IsEnum(OuvResultado)
  resultado?: OuvResultado;

  @IsOptional()
  @Transform(toOptionalInt)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(toOptionalInt)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
