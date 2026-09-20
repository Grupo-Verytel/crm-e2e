import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { enqueueLeadImport, fetchImportStatus } from '../../api/leads-api';
import {
  downloadLeadImportTemplate,
  excelColumnLetter,
  fileToLeadImportCsv,
  LEAD_CSV_FIELDS,
  snapshotImportFile,
} from '../../lib/lead-bulk-import';
import { loadLeadImportCatalog } from '../../lib/lead-import-catalog';
import type { BulkImportJobStatus } from '../../types';
import { ModalShell } from '../ModalShell';
import { ghostButtonClass, primaryButtonClass } from '../ui';

export { LEAD_CSV_FIELDS };

type Step = 'guide' | 'upload' | 'processing' | 'done';

type Props = {
  onClose: () => void;
  onDone?: () => void;
};

export function LeadBulkImportModal({ onClose, onDone }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('guide');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<BulkImportJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

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

  async function pollUntilDone(jobId: string) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const current = await fetchImportStatus(jobId);
      setStatus(current);
      if (current.status === 'completed' || current.status === 'failed') {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
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
      const accepted = await enqueueLeadImport(csvFile);
      await pollUntilDone(accepted.job_id);
      setStep('done');
      onDone?.();
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : 'No se pudo importar el archivo.',
      );
      setStep('upload');
    }
  }

  return (
    <ModalShell title="Carga masiva de leads" onClose={onClose} size="wide">
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
              la lista; si no está, créala antes en Empresas. Los duplicados
              por email + NIT se omiten. El responsable es quien hace la carga.
            </p>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={ghostButtonClass} onClick={onClose}>
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
              <button type="button" className={primaryButtonClass} onClick={onClose}>
                Cerrar
              </button>
            </div>
          </>
        ) : null}
      </div>
    </ModalShell>
  );
}
