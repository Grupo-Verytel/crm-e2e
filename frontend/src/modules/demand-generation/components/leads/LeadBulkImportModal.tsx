import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { enqueueLeadImport } from '../../api/leads-api';
import {
  downloadLeadImportTemplate,
  excelColumnLetter,
  fileToLeadImportCsv,
  LEAD_CSV_FIELDS,
  snapshotImportFile,
} from '../../lib/lead-bulk-import';
import { loadLeadImportCatalog } from '../../lib/lead-import-catalog';
import {
  duplicateImportRows,
  importRowKey,
  pollLeadImportJob,
} from '../../lib/lead-import-job';
import type { BulkImportJobStatus } from '../../types';
import { ModalShell } from '../ModalShell';
import { ghostButtonClass, primaryButtonClass } from '../ui';
import { LeadImportDuplicateReview } from './LeadImportDuplicateReview';

export { LEAD_CSV_FIELDS };

type Step = 'guide' | 'upload' | 'processing' | 'review' | 'done';

type Props = {
  onClose: () => void;
  onDone?: () => void;
};

export function LeadBulkImportModal({ onClose, onDone }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvFileRef = useRef<File | null>(null);
  const [step, setStep] = useState<Step>('guide');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<BulkImportJobStatus | null>(null);
  const [authorizedKeys, setAuthorizedKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleDownloadTemplate() {
    setDownloading(true);
    setError(null);
    try {
      const catalog = await loadLeadImportCatalog();
      downloadLeadImportTemplate(catalog);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : 'No se pudo descargar la plantilla.',
      );
    } finally {
      setDownloading(false);
    }
  }

  async function runImport(
    csvFile: File,
    authorizedDuplicates?: Array<{ row: number; email: string }>,
  ): Promise<BulkImportJobStatus> {
    const accepted = await enqueueLeadImport(csvFile, {
      authorizedDuplicates,
    });
    return pollLeadImportJob(accepted.job_id);
  }

  function finish(current: BulkImportJobStatus) {
    setStatus(current);
    setStep('done');
    onDone?.();
  }

  async function handleImport() {
    if (!file) return;
    setStep('processing');
    setError(null);
    try {
      const csv = await fileToLeadImportCsv(file);
      const csvFile = new File([csv], file.name.replace(/\.(xls|xlsx)$/i, '.csv'), {
        type: 'text/csv',
      });
      csvFileRef.current = csvFile;
      const current = await runImport(csvFile);
      if (current.status === 'failed') {
        setStatus(current);
        setStep('done');
        return;
      }
      if (duplicateImportRows(current).length > 0) {
        setStatus(current);
        setAuthorizedKeys(new Set());
        setStep('review');
        return;
      }
      finish(current);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : 'No se pudo importar el archivo.',
      );
      setStep('upload');
    }
  }

  async function handleConfirmAuthorized() {
    const csvFile = csvFileRef.current;
    const current = status;
    if (!csvFile || !current) return;
    const authorizedDuplicates = duplicateImportRows(current)
      .filter((row) => authorizedKeys.has(importRowKey(row.row, row.email)))
      .map((row) => ({ row: row.row, email: row.email }));
    if (authorizedDuplicates.length === 0) {
      finish(current);
      return;
    }
    setConfirming(true);
    setError(null);
    try {
      const next = await runImport(csvFile, authorizedDuplicates);
      finish({
        ...next,
        created: current.created + next.created,
        created_lead_ids: [
          ...current.created_lead_ids,
          ...next.created_lead_ids,
        ],
        total_rows: current.total_rows,
        skipped: next.skipped.filter((row) => {
          const firstRow = current.rows?.find((item) => item.row === row.row);
          return firstRow?.outcome !== 'created';
        }),
      });
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : 'No se pudieron crear los leads autorizados.',
      );
    } finally {
      setConfirming(false);
    }
  }

  function toggleAuthorized(key: string) {
    setAuthorizedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleAllAuthorized(keys: string[]) {
    setAuthorizedKeys((prev) => {
      const allSelected = keys.every((key) => prev.has(key));
      return allSelected ? new Set() : new Set(keys);
    });
  }

  function handleClose() {
    if (status && status.created > 0) {
      onDone?.();
    }
    onClose();
  }

  return (
    <ModalShell title="Carga masiva de leads" onClose={handleClose} size="wide">
      <div className="space-y-4">
        {step === 'guide' ? (
          <>
            <p className="text-sm text-muted">
              Descarga la plantilla Excel (.xlsx). En origen, canal, segmento,
              ciudad, empresa y las demás columnas de catálogo abre la flecha y
              elige un valor de la lista. La región se infiere de la ciudad.
              La empresa debe existir en el CRM; el cargue no crea empresas.
            </p>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 font-bold">Columna Excel</th>
                    <th className="px-3 py-2 font-bold">Campo</th>
                    <th className="px-3 py-2 font-bold">Obligatorio</th>
                    <th className="px-3 py-2 font-bold">Guía</th>
                  </tr>
                </thead>
                <tbody>
                  {LEAD_CSV_FIELDS.map((field, index) => (
                    <tr key={field.key} className="border-b border-border">
                      <td className="px-3 py-2 font-bold text-ink">
                        {excelColumnLetter(index)}
                      </td>
                      <td className="px-3 py-2 text-ink">{field.label}</td>
                      <td className="px-3 py-2 text-muted">
                        {field.required ? 'Sí' : 'No'}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted">
                        {field.hint}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">
              El nombre del lead se genera con la empresa. Elige la empresa de
              la lista; si no está, créala antes en Empresas. Si coinciden
              empresa y email con un lead ya creado, verás el cargue completo y
              tendrás que autorizar cada fila duplicada para crearla. El
              responsable es quien hace la carga.
            </p>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={ghostButtonClass} onClick={handleClose}>
                Cancelar
              </button>
              <button
                type="button"
                className={ghostButtonClass}
                disabled={downloading}
                onClick={() => void handleDownloadTemplate()}
              >
                <span className="inline-flex items-center gap-2">
                  <Download size={16} strokeWidth={2} />
                  {downloading ? 'Preparando plantilla…' : 'Descargar plantilla'}
                </span>
              </button>
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => setStep('upload')}
              >
                Siguiente
              </button>
            </div>
          </>
        ) : null}

        {step === 'upload' ? (
          <>
            <p className="text-sm text-muted">
              Selecciona la plantilla completa (.xlsx) o un CSV UTF-8.
            </p>
            <div className="rounded border border-border bg-bg p-4">
              <p className="mb-2 text-sm font-bold text-ink">Archivo</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="sr-only"
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  event.target.value = '';
                  setError(null);
                  if (!selected) {
                    setFile(null);
                    return;
                  }
                  void snapshotImportFile(selected)
                    .then(setFile)
                    .catch((snapshotError: unknown) => {
                      setFile(null);
                      setError(
                        snapshotError instanceof Error
                          ? snapshotError.message
                          : 'No se pudo leer el archivo seleccionado.',
                      );
                    });
                }}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className={ghostButtonClass}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="inline-flex items-center gap-2">
                    <Upload size={16} strokeWidth={2} />
                    Seleccionar archivo
                  </span>
                </button>
                <span className="text-sm text-muted">
                  {file ? file.name : 'Ningún archivo seleccionado'}
                </span>
              </div>
              {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={ghostButtonClass}
                onClick={() => {
                  setStep('guide');
                  setError(null);
                }}
              >
                Volver
              </button>
              <button
                type="button"
                className={ghostButtonClass}
                disabled={downloading}
                onClick={() => void handleDownloadTemplate()}
              >
                <span className="inline-flex items-center gap-2">
                  <Download size={16} strokeWidth={2} />
                  {downloading ? 'Preparando plantilla…' : 'Descargar plantilla'}
                </span>
              </button>
              <button
                type="button"
                className={primaryButtonClass}
                disabled={!file}
                onClick={() => void handleImport()}
              >
                Importar
              </button>
            </div>
          </>
        ) : null}

        {step === 'processing' ? (
          <p className="py-6 text-center text-sm text-muted">
            Procesando importación en segundo plano…
          </p>
        ) : null}

        {step === 'review' && status ? (
          <LeadImportDuplicateReview
            status={status}
            authorizedKeys={authorizedKeys}
            confirming={confirming}
            error={error}
            onToggle={toggleAuthorized}
            onToggleAll={toggleAllAuthorized}
            onDecline={() => finish(status)}
            onConfirm={() => void handleConfirmAuthorized()}
          />
        ) : null}

        {step === 'done' && status ? (
          <>
            {status.status === 'failed' ? (
              <p className="text-sm text-danger">
                Importación fallida: {status.error}
              </p>
            ) : (
              <p className="text-sm text-ink">
                Importación completada:{' '}
                <span className="font-bold">{status.created}</span> leads
                creados, {status.skipped.length} omitidos.
              </p>
            )}
            {status.skipped.length > 0 ? (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted">
                {status.skipped.map((row) => (
                  <li key={`${row.row}-${row.email}`}>
                    Fila {row.row} ({row.email || 'sin email'}): {row.reason}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex justify-end gap-2">
              <button type="button" className={primaryButtonClass} onClick={handleClose}>
                Cerrar
              </button>
            </div>
          </>
        ) : null}
      </div>
    </ModalShell>
  );
}
