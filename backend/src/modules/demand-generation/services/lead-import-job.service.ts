import { HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CSV_LEAD_REQUIRED_HEADERS,
  DEMAND_GENERATION_ERROR_CODES,
  LEAD_IMPORT_DUPLICATE_REASON,
  LEAD_IMPORT_SKIP_CODES,
} from '../constants/demand-generation.constants';
import {
  AuthorizedDuplicateRowDto,
  BulkImportJobAcceptedDto,
  BulkImportJobStatusDto,
  BulkImportOptionsDto,
  BulkImportRowResultDto,
  BulkImportSkippedRowDto,
  ImportJobStatus,
} from '../dtos/bulk-import-job.dto';
import { parseCsvContent, type ParsedCsvRow } from '../lib/csv-parser';
import { resolveSegmentoFromInput } from '../lib/segment-catalog';
import { SegmentoObjetivo } from '../models/enums/segment.enum';
import { LeadsService } from './leads.service';

interface ImportJob {
  jobId: string;
  status: ImportJobStatus;
  totalRows: number;
  created: number;
  skipped: BulkImportSkippedRowDto[];
  rows: BulkImportRowResultDto[];
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

  enqueue(
    csvContent: string,
    createdBy: string,
    options: BulkImportOptionsDto = {},
  ): BulkImportJobAcceptedDto {
    const jobId = randomUUID();
    const job: ImportJob = {
      jobId,
      status: 'pending',
      totalRows: 0,
      created: 0,
      skipped: [],
      rows: [],
      createdLeadIds: [],
      error: null,
      startedAt: new Date(),
      finishedAt: null,
    };
    this.jobs.set(jobId, job);

    // Fire-and-forget: the response returns 202 before processing finishes.
    void this.process(jobId, csvContent, createdBy, options);

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
      rows: job.rows,
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
    options: BulkImportOptionsDto,
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    job.status = 'processing';

    let rows: ParsedCsvRow[];
    try {
      rows = parseCsvContent(csvContent, CSV_LEAD_REQUIRED_HEADERS);
      this.assertExpectedSegmento(rows, options.expected_segmento);
    } catch (error) {
      job.status = 'failed';
      job.error =
        error instanceof Error ? error.message : 'Invalid CSV content';
      job.finishedAt = new Date();
      this.logger.warn(`Import job ${jobId} failed: ${job.error}`);
      return;
    }

    job.totalRows = rows.length;
    const importOptions = {
      campanaId: options.campana_id,
      canalOrigen: options.canal_origen,
    };

    for (const row of rows) {
      const email = row.values.email?.trim().toLowerCase() ?? '';
      const nit = row.values.tax_id || row.values.nit || null;
      const accountRaw =
        row.values.account_name ||
        row.values.empresa ||
        row.values.empresa_nombre ||
        '';
      const contactoNombre = row.values.contacto_nombre?.trim() || null;

      if (!email) {
        this.recordSkip(job, {
          row: row.rowNumber,
          email: '',
          nit,
          account_name: accountRaw || null,
          contacto_nombre: contactoNombre,
          reason: 'Missing email',
          code: null,
        });
        continue;
      }

      try {
        const duplicate = await this.leadsService.findDuplicateByEmailAndNit(
          email,
          nit,
          accountRaw,
        );
        const authorized = this.isAuthorizedDuplicate(
          options.authorized_duplicates,
          row.rowNumber,
          email,
        );

        if (duplicate && !authorized) {
          this.recordSkip(job, {
            row: row.rowNumber,
            email,
            nit,
            account_name: accountRaw || null,
            contacto_nombre: contactoNombre,
            reason: LEAD_IMPORT_DUPLICATE_REASON,
            code: LEAD_IMPORT_SKIP_CODES.DUPLICATE_ACCOUNT_EMAIL,
            existing_lead_id: duplicate.leadId,
            existing_lead_name: duplicate.name,
            outcome: 'duplicate',
          });
          continue;
        }

        const lead = await this.leadsService.importLeadRow(
          row.values,
          createdBy,
          {
            ...importOptions,
            allowDuplicate: Boolean(duplicate && authorized),
          },
        );
        job.created += 1;
        job.createdLeadIds.push(lead.leadId);
        job.rows.push({
          row: row.rowNumber,
          email,
          nit,
          account_name: accountRaw || null,
          contacto_nombre: contactoNombre,
          outcome: 'created',
          reason: null,
          code: null,
          lead_id: lead.leadId,
          existing_lead_id: duplicate?.leadId ?? null,
          existing_lead_name: duplicate?.name ?? null,
        });
      } catch (error) {
        const reason = this.importSkipReason(error);
        const isDuplicate = reason === LEAD_IMPORT_DUPLICATE_REASON;
        this.recordSkip(job, {
          row: row.rowNumber,
          email,
          nit,
          account_name: accountRaw || null,
          contacto_nombre: contactoNombre,
          reason,
          code: isDuplicate
            ? LEAD_IMPORT_SKIP_CODES.DUPLICATE_ACCOUNT_EMAIL
            : null,
          outcome: isDuplicate ? 'duplicate' : 'skipped',
        });
      }
    }

    job.status = 'completed';
    job.finishedAt = new Date();
    this.logger.log(
      `Import job ${jobId} completed: ${job.created} created, ${job.skipped.length} skipped`,
    );
  }

  private isAuthorizedDuplicate(
    authorized: AuthorizedDuplicateRowDto[] | undefined,
    row: number,
    email: string,
  ): boolean {
    if (!authorized?.length) {
      return false;
    }
    return authorized.some(
      (item) =>
        item.row === row && item.email.trim().toLowerCase() === email,
    );
  }

  private recordSkip(
    job: ImportJob,
    entry: {
      row: number;
      email: string;
      nit: string | null;
      account_name: string | null;
      contacto_nombre: string | null;
      reason: string;
      code: string | null;
      existing_lead_id?: string | null;
      existing_lead_name?: string | null;
      outcome?: 'duplicate' | 'skipped';
    },
  ): void {
    job.skipped.push({
      row: entry.row,
      email: entry.email,
      nit: entry.nit,
      reason: entry.reason,
      code: entry.code ?? undefined,
      account_name: entry.account_name,
      contacto_nombre: entry.contacto_nombre,
      existing_lead_id: entry.existing_lead_id ?? null,
      existing_lead_name: entry.existing_lead_name ?? null,
    });
    job.rows.push({
      row: entry.row,
      email: entry.email,
      nit: entry.nit,
      account_name: entry.account_name,
      contacto_nombre: entry.contacto_nombre,
      outcome: entry.outcome ?? 'skipped',
      reason: entry.reason,
      code: entry.code,
      lead_id: null,
      existing_lead_id: entry.existing_lead_id ?? null,
      existing_lead_name: entry.existing_lead_name ?? null,
    });
  }

  private importSkipReason(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (typeof response === 'object' && response && 'message' in response) {
        const message = (response as { message: string | string[] }).message;
        return Array.isArray(message) ? message.join(', ') : String(message);
      }
    }
    return error instanceof Error ? error.message : 'Failed to create lead';
  }

  private assertExpectedSegmento(
    rows: ParsedCsvRow[],
    expectedSegmento: string | undefined,
  ): void {
    const expected = expectedSegmento?.trim();
    if (!expected || expected === SegmentoObjetivo.Todos) {
      return;
    }

    for (const row of rows) {
      const actual = resolveSegmentoFromInput(row.values.segmento);
      if (actual !== expected) {
        throw new Error(
          `La fila ${row.rowNumber}: el segmento "${row.values.segmento || ''}" no coincide con el segmento objetivo "${expected}".`,
        );
      }
    }
  }
}
