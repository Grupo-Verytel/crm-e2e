import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CanalOrigen } from '../models/enums/lead.enums';

export type ImportJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type BulkImportRowOutcome = 'created' | 'duplicate' | 'skipped';

export class AuthorizedDuplicateRowDto {
  @Type(() => Number)
  @IsInt()
  row!: number;

  @IsString()
  @IsNotEmpty()
  email!: string;
}

export class BulkImportOptionsDto {
  @IsOptional()
  @IsUUID('4')
  campana_id?: string;

  /** When set (and not "Todos"), every Excel row must use this segmento. */
  @IsOptional()
  @IsString()
  expected_segmento?: string;

  @IsOptional()
  @IsEnum(CanalOrigen)
  canal_origen?: CanalOrigen;

  /** Rows the user explicitly authorized after a duplicate empresa+email warning. */
  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AuthorizedDuplicateRowDto)
  authorized_duplicates?: AuthorizedDuplicateRowDto[];
}

export class BulkImportSkippedRowDto {
  row: number;
  email: string;
  nit: string | null;
  reason: string;
  code?: string;
  account_name?: string | null;
  contacto_nombre?: string | null;
  existing_lead_id?: string | null;
  existing_lead_name?: string | null;
}

export class BulkImportRowResultDto {
  row: number;
  email: string;
  nit: string | null;
  account_name: string | null;
  contacto_nombre: string | null;
  outcome: BulkImportRowOutcome;
  reason: string | null;
  code: string | null;
  lead_id: string | null;
  existing_lead_id: string | null;
  existing_lead_name: string | null;
}

/** 202 Accepted payload — the job is queued and processed in the background. */
export class BulkImportJobAcceptedDto {
  job_id: string;
  status: ImportJobStatus;
}

export class BulkImportJobStatusDto {
  job_id: string;
  status: ImportJobStatus;
  total_rows: number;
  created: number;
  skipped: BulkImportSkippedRowDto[];
  rows: BulkImportRowResultDto[];
  created_lead_ids: string[];
  error: string | null;
  started_at: Date;
  finished_at: Date | null;
}
