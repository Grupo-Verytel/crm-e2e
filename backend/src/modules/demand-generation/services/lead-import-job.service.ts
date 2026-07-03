import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CSV_LEAD_HEADERS,
  DEMAND_GENERATION_ERROR_CODES,
} from '../constants/demand-generation.constants';
import {
  BulkImportJobAcceptedDto,
  BulkImportJobStatusDto,
  BulkImportSkippedRowDto,
  ImportJobStatus,
} from '../dtos/bulk-import-job.dto';
import { parseCsvContent, type ParsedCsvRow } from '../lib/csv-parser';
import { LeadsService } from './leads.service';

interface ImportJob {
  jobId: string;
  status: ImportJobStatus;
  totalRows: number;
  created: number;
  skipped: BulkImportSkippedRowDto[];
  createdLeadIds: string[];
  error: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}

/**
 * In-process async import runner (DG-08). The project has no queue/job library
 * and AGENTS.md forbids adding one, so the CSV is processed in the background
 * with an in-memory job registry: POST returns 202 immediately and the work
 * continues after the response.
 */
@Injectable()
export class LeadImportJobService {
  private readonly logger = new Logger('LeadImport');
  private readonly jobs = new Map<string, ImportJob>();

  constructor(private readonly leadsService: LeadsService) {}

  enqueue(csvContent: string, createdBy: string): BulkImportJobAcceptedDto {
    const jobId = randomUUID();
    const job: ImportJob = {
      jobId,
      status: 'pending',
      totalRows: 0,
      created: 0,
      skipped: [],
      createdLeadIds: [],
      error: null,
      startedAt: new Date(),
      finishedAt: null,
    };
    this.jobs.set(jobId, job);

    // Fire-and-forget: the response returns 202 before processing finishes.
    void this.process(jobId, csvContent, createdBy);

    return { job_id: jobId, status: job.status };
  }

  getStatus(jobId: string): BulkImportJobStatusDto {
    const job = this.jobs.get(jobId);

    if (!job) {
      throw new NotFoundException({
        code: DEMAND_GENERATION_ERROR_CODES.IMPORT_JOB_NOT_FOUND,
        message: 'Import job not found',
      });
    }

    return {
      job_id: job.jobId,
      status: job.status,
      total_rows: job.totalRows,
      created: job.created,
      skipped: job.skipped,
      created_lead_ids: job.createdLeadIds,
      error: job.error,
      started_at: job.startedAt,
      finished_at: job.finishedAt,
    };
  }

  private async process(
    jobId: string,
    csvContent: string,
    createdBy: string,
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    job.status = 'processing';

    let rows: ParsedCsvRow[];
    try {
      rows = parseCsvContent(csvContent, CSV_LEAD_HEADERS);
    } catch (error) {
      job.status = 'failed';
      job.error =
        error instanceof Error ? error.message : 'Invalid CSV content';
      job.finishedAt = new Date();
      this.logger.warn(`Import job ${jobId} failed: ${job.error}`);
      return;
    }

    job.totalRows = rows.length;

    for (const row of rows) {
      const email = row.values.email?.toLowerCase();
      const nit = row.values.nit || null;

      if (!email) {
        job.skipped.push({
          row: row.rowNumber,
          email: '',
          nit,
          reason: 'Missing email',
        });
        continue;
      }

      try {
        const duplicate = await this.leadsService.findDuplicateByEmailAndNit(
          email,
          nit,
        );

        if (duplicate) {
          job.skipped.push({
            row: row.rowNumber,
            email,
            nit,
            reason: 'Duplicate email+nit',
          });
          continue;
        }

        const lead = await this.leadsService.importLeadRow(
          row.values,
          createdBy,
        );
        job.created += 1;
        job.createdLeadIds.push(lead.leadId);
      } catch (error) {
        job.skipped.push({
          row: row.rowNumber,
          email,
          nit,
          reason:
            error instanceof Error ? error.message : 'Failed to create lead',
        });
      }
    }

    job.status = 'completed';
    job.finishedAt = new Date();
    this.logger.log(
      `Import job ${jobId} completed: ${job.created} created, ${job.skipped.length} skipped`,
    );
  }
}
