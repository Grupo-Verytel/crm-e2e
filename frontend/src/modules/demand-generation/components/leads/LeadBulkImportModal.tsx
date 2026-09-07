import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { enqueueLeadImport, fetchImportStatus } from '../../api/leads-api';
import type { BulkImportJobStatus } from '../../types';
import { ModalShell } from '../ModalShell';
import { ghostButtonClass, primaryButtonClass } from '../ui';

/** CSV columns expected by POST /leads/bulk-import (backend CSV_LEAD_HEADERS). */
export const LEAD_CSV_FIELDS: {
  key: string;
  label: string;
  required: boolean;
  hint: string;
}[] = [
  { key: 'name', label: 'Nombre del lead', required: true, hint: 'Único; no se puede repetir' },
  { key: 'tipo_lead', label: 'Tipo de lead', required: true, hint: 'Inbound, Outbound, Referido, Aliado, Licitacion' },
  { key: 'origen', label: 'Origen', required: true, hint: 'Web, Email, LinkedIn, Evento, SECOP, Aliado, Otro, Referido' },
  { key: 'canal_origen', label: 'Canal de origen', required: true, hint: 'CAMPANA_DIGITAL, BTL, FABRICA, EVENTOS, …' },
  { key: 'segmento', label: 'Segmento', required: true, hint: 'Gobierno, D&S, ProyectosEspeciales, B2B' },
  { key: 'industria', label: 'Industria', required: false, hint: 'Obligatoria si segmento = B2B' },
  { key: 'city', label: 'Ciudad', required: true, hint: 'Municipio Colombia' },
  { key: 'region', label: 'Región', required: true, hint: 'Departamento' },
  { key: 'pais', label: 'País', required: false, hint: 'ISO-2; por defecto CO' },
  { key: 'account_name', label: 'Empresa', required: true, hint: 'Nombre de la cuenta' },
  { key: 'tax_id', label: 'NIT', required: true, hint: 'NIT de la empresa' },
  { key: 'contacto_nombre', label: 'Contacto', required: true, hint: 'Nombre del contacto principal' },
  { key: 'cargo', label: 'Cargo', required: false, hint: 'Cargo del contacto' },
  { key: 'email', label: 'Email', required: true, hint: 'Correo del contacto' },
  { key: 'telefono', label: 'Teléfono', required: false, hint: 'Teléfono del contacto' },
  { key: 'responsable_id', label: 'Responsable (UUID)', required: true, hint: 'user_id del gestor/responsable' },
  { key: 'campana_id', label: 'Campaña (UUID)', required: false, hint: 'campana_id si aplica' },
];

type Step = 'guide' | 'upload' | 'processing' | 'done';

type Props = {
  onClose: () => void;
  onDone?: () => void;
};

function excelColumnLetter(index: number): string {
  let n = index;
  let letter = '';
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

export function LeadBulkImportModal({ onClose, onDone }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('guide');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<BulkImportJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      const accepted = await enqueueLeadImport(file);
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
              Arma el Excel en este orden de columnas (fila 1 = encabezados con
              el nombre del campo). Guarda como CSV UTF-8 antes de continuar.
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
              Los duplicados por email + NIT se omiten automáticamente.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={ghostButtonClass} onClick={onClose}>
                Cancelar
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
              Selecciona el archivo CSV exportado desde Excel.
            </p>
            <div className="rounded border border-border bg-bg p-4">
              <p className="mb-2 text-sm font-bold text-ink">Archivo CSV</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setError(null);
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
