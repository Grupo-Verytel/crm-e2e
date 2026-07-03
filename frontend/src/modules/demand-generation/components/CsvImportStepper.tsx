import { useState } from 'react';
import { enqueueLeadImport, fetchImportStatus } from '../api/leads-api';
import type { BulkImportJobStatus } from '../types';
import { cardClass, ghostButtonClass, primaryButtonClass } from './ui';

const EXPECTED_HEADERS = [
  'tipo_lead',
  'origen',
  'segmento',
  'industria',
  'region',
  'pais',
  'empresa_nombre',
  'nit',
  'contacto_nombre',
  'cargo',
  'email',
  'telefono',
  'responsable_id',
  'campana_id',
];

type Step = 'upload' | 'mapping' | 'processing' | 'done';

export function CsvImportStepper() {
  const [step, setStep] = useState<Step>('upload');
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

  async function handleConfirm() {
    if (!file) return;
    setStep('processing');
    setError(null);
    try {
      const accepted = await enqueueLeadImport(file);
      await pollUntilDone(accepted.job_id);
      setStep('done');
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : 'No se pudo importar el archivo.',
      );
      setStep('mapping');
    }
  }

  function reset() {
    setStep('upload');
    setFile(null);
    setStatus(null);
    setError(null);
  }

  return (
    <div className={`${cardClass} p-5`}>
      <h2 className="mb-1 text-sm font-bold text-ink">Importar leads (CSV)</h2>
      <p className="mb-4 text-xs text-muted">
        Paso {stepIndex(step)} de 4 · Upload → Mapeo → Validación → Confirmar
      </p>

      {step === 'upload' ? (
        <div className="space-y-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <div>
            <button
              type="button"
              disabled={!file}
              onClick={() => setStep('mapping')}
              className={primaryButtonClass}
            >
              Continuar
            </button>
          </div>
        </div>
      ) : null}

      {step === 'mapping' ? (
        <div className="space-y-3">
          <p className="text-sm text-ink">
            Archivo: <span className="font-bold">{file?.name}</span>
          </p>
          <p className="text-xs text-muted">
            El sistema mapea automáticamente estas columnas por encabezado. Verifica que
            tu CSV las incluya. Los duplicados por email+NIT se omiten en la validación.
          </p>
          <div className="flex flex-wrap gap-2">
            {EXPECTED_HEADERS.map((header) => (
              <span
                key={header}
                className="rounded-sm border border-border px-2 py-0.5 text-xs text-muted"
              >
                {header}
              </span>
            ))}
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex gap-2">
            <button type="button" onClick={reset} className={ghostButtonClass}>
              Volver
            </button>
            <button type="button" onClick={handleConfirm} className={primaryButtonClass}>
              Validar e importar
            </button>
          </div>
        </div>
      ) : null}

      {step === 'processing' ? (
        <p className="text-sm text-muted">Procesando importación en segundo plano…</p>
      ) : null}

      {step === 'done' && status ? (
        <div className="space-y-3">
          {status.status === 'failed' ? (
            <p className="text-sm text-danger">Importación fallida: {status.error}</p>
          ) : (
            <p className="text-sm text-ink">
              Importación completada: <span className="font-bold">{status.created}</span>{' '}
              leads creados, {status.skipped.length} omitidos.
            </p>
          )}
          {status.skipped.length > 0 ? (
            <ul className="space-y-1 text-xs text-muted">
              {status.skipped.map((row) => (
                <li key={`${row.row}-${row.email}`}>
                  Fila {row.row} ({row.email || 'sin email'}): {row.reason}
                </li>
              ))}
            </ul>
          ) : null}
          <button type="button" onClick={reset} className={ghostButtonClass}>
            Importar otro archivo
          </button>
        </div>
      ) : null}
    </div>
  );
}

function stepIndex(step: Step): number {
  return { upload: 1, mapping: 2, processing: 3, done: 4 }[step];
}
