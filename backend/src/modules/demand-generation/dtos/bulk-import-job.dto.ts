import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { CanalOrigen } from '../models/enums/lead.enums';

export type ImportJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

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
}

export class BulkImportSkippedRowDto {
  row: number;
  email: string;
  nit: string | null;
  reason: string;
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
  created_lead_ids: string[];
  error: string | null;
  started_at: Date;
  finished_at: Date | null;
}
