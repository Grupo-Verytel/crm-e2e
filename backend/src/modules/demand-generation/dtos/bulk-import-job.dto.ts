export type ImportJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

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
