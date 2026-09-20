import type { BulkImportJobStatus, BulkImportRowResult } from '../types';
import { fetchImportStatus } from '../api/leads-api';

export const LEAD_IMPORT_DUPLICATE_CODE = 'DUPLICATE_ACCOUNT_EMAIL';

export function importRowKey(row: number, email: string): string {
  return `${row}:${email.trim().toLowerCase()}`;
}

export function isDuplicateImportRow(
  row: Pick<BulkImportRowResult, 'outcome' | 'code' | 'reason'>,
): boolean {
  return (
    row.outcome === 'duplicate' ||
    row.code === LEAD_IMPORT_DUPLICATE_CODE ||
    (row.reason ?? '').includes('empresa y este email')
  );
}

export function importResultRows(status: BulkImportJobStatus): BulkImportRowResult[] {
  if (status.rows?.length) {
    return status.rows;
  }
  return status.skipped.map((row) => ({
    row: row.row,
    email: row.email,
    nit: row.nit,
    account_name: row.account_name ?? null,
    contacto_nombre: row.contacto_nombre ?? null,
    outcome: isDuplicateImportRow({
      outcome: 'skipped',
      code: row.code ?? null,
      reason: row.reason,
    })
      ? 'duplicate'
      : 'skipped',
    reason: row.reason,
    code: row.code ?? null,
    lead_id: null,
    existing_lead_id: row.existing_lead_id ?? null,
    existing_lead_name: row.existing_lead_name ?? null,
  }));
}

export function duplicateImportRows(
  status: BulkImportJobStatus,
): BulkImportRowResult[] {
  return importResultRows(status).filter((row) => isDuplicateImportRow(row));
}

export async function pollLeadImportJob(
  jobId: string,
): Promise<BulkImportJobStatus> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const current = await fetchImportStatus(jobId);
    if (current.status === 'completed' || current.status === 'failed') {
      return current;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(
    'La importación sigue en proceso. Revisa los leads en unos minutos.',
  );
}
