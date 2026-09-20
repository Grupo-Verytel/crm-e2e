import { ghostButtonClass, primaryButtonClass } from '../ui';
import type { BulkImportJobStatus, BulkImportRowResult } from '../../types';
import {
  duplicateImportRows,
  importResultRows,
  importRowKey,
} from '../../lib/lead-import-job';

const OUTCOME_LABEL: Record<BulkImportRowResult['outcome'], string> = {
  created: 'Creado',
  duplicate: 'Duplicado',
  skipped: 'Omitido',
};

type Props = {
  status: BulkImportJobStatus;
  authorizedKeys: Set<string>;
  confirming?: boolean;
  error?: string | null;
  onToggle: (key: string) => void;
  onToggleAll: (keys: string[]) => void;
  onDecline: () => void;
  onConfirm: () => void;
  declineLabel?: string;
};

export function LeadImportDuplicateReview({
  status,
  authorizedKeys,
  confirming = false,
  error,
  onToggle,
  onToggleAll,
  onDecline,
  onConfirm,
  declineLabel = 'No crear duplicados',
}: Props) {
  const rows = importResultRows(status);
  const duplicates = duplicateImportRows(status);
  const duplicateKeys = duplicates.map((row) => importRowKey(row.row, row.email));
  const allAuthorized =
    duplicateKeys.length > 0 &&
    duplicateKeys.every((key) => authorizedKeys.has(key));
  const authorizedCount = duplicateKeys.filter((key) =>
    authorizedKeys.has(key),
  ).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink">
        El archivo tiene{' '}
        <span className="font-bold">{status.total_rows}</span> filas:{' '}
        <span className="font-bold">{status.created}</span> leads creados,{' '}
        <span className="font-bold">{duplicates.length}</span> duplicados por
        empresa y email, {status.skipped.length - duplicates.length} omitidos
        por otro motivo.
      </p>
      <p className="text-sm text-muted">
        Marca cada duplicado que quieras crear igual. Sin tu autorización
        expresa esa fila no se convierte en un lead nuevo.
      </p>
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-bg text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-2 font-bold">Autorizar</th>
              <th className="px-3 py-2 font-bold">Fila</th>
              <th className="px-3 py-2 font-bold">Resultado</th>
              <th className="px-3 py-2 font-bold">Empresa</th>
              <th className="px-3 py-2 font-bold">Contacto</th>
              <th className="px-3 py-2 font-bold">Email</th>
              <th className="px-3 py-2 font-bold">Lead existente</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = importRowKey(row.row, row.email);
              const isDuplicate = row.outcome === 'duplicate';
              return (
                <tr key={key} className="border-b border-border align-top">
                  <td className="px-3 py-2">
                    {isDuplicate ? (
                      <label className="inline-flex items-center gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          checked={authorizedKeys.has(key)}
                          onChange={() => onToggle(key)}
                        />
                        <span className="sr-only">
                          Autorizar fila {row.row}
                        </span>
                      </label>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ink">{row.row}</td>
                  <td className="px-3 py-2 font-bold text-ink">
                    {OUTCOME_LABEL[row.outcome]}
                  </td>
                  <td className="px-3 py-2 text-ink">
                    {row.account_name || '—'}
                  </td>
                  <td className="px-3 py-2 text-ink">
                    {row.contacto_nombre || '—'}
                  </td>
                  <td className="px-3 py-2 text-ink">{row.email || '—'}</td>
                  <td className="px-3 py-2 text-muted">
                    {isDuplicate
                      ? row.existing_lead_name ||
                        row.reason ||
                        'Ya existe un lead con esta empresa y este email'
                      : row.reason || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className={ghostButtonClass}
          disabled={confirming || duplicateKeys.length === 0}
          onClick={() => onToggleAll(duplicateKeys)}
        >
          {allAuthorized ? 'Quitar autorización' : 'Autorizar todos'}
        </button>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={ghostButtonClass}
            disabled={confirming}
            onClick={onDecline}
          >
            {declineLabel}
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            disabled={confirming || authorizedCount === 0}
            onClick={onConfirm}
          >
            {confirming
              ? 'Creando leads…'
              : `Crear ${authorizedCount} autorizados`}
          </button>
        </div>
      </div>
    </div>
  );
}
