import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { crearOuvDirecta } from '../api/ouvs-api';
import { SEGMENTOS, VERTICALES } from '../lib/ouv-vocab';
import { ModalShell } from './ModalShell';
import { ghostButtonClass, primaryButtonClass } from './ui';

/** Columns for Excel/CSV bulk create of direct OUVs. */
export const OUV_CSV_FIELDS: {
  key: string;
  label: string;
  required: boolean;
  hint: string;
}[] = [
  {
    key: 'titulo',
    label: 'Título',
    required: true,
    hint: 'Nombre de la oportunidad',
  },
  {
    key: 'empresa_nombre',
    label: 'Empresa',
    required: true,
    hint: 'Razón social / cuenta',
  },
  {
    key: 'segmento',
    label: 'Segmento',
    required: true,
    hint: SEGMENTOS.join(', '),
  },
  {
    key: 'vertical',
    label: 'Vertical',
    required: true,
    hint: VERTICALES.slice(0, 4).join(', ') + '…',
  },
  {
    key: 'descripcion',
    label: 'Descripción',
    required: true,
    hint: 'Contexto breve de la OUV',
  },
  {
    key: 'account_id',
    label: 'Cuenta (UUID)',
    required: false,
    hint: 'account_id si ya existe en Empresas',
  },
];

type Step = 'guide' | 'upload' | 'processing' | 'done';

type Props = {
  onClose: () => void;
  onDone?: () => void;
};

type ImportResult = {
  created: number;
  skipped: { row: number; reason: string }[];
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

/** Minimal CSV parser (header row + comma-separated, supports quoted fields). */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return [];
  }
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? '').trim();
    });
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

export function OuvBulkImportModal({ onClose, onDone }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('guide');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  async function handleImport() {
    if (!file) return;
    setStep('processing');
    setError(null);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setError('El archivo no tiene filas de datos.');
        setStep('upload');
        return;
      }

      const skipped: ImportResult['skipped'] = [];
      let created = 0;

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const rowNum = i + 2;
        setProgress(`Fila ${rowNum - 1} de ${rows.length}…`);

        const titulo = row.titulo?.trim();
        const empresa = row.empresa_nombre?.trim();
        const segmento = row.segmento?.trim();
        const vertical = row.vertical?.trim();
        const descripcion = row.descripcion?.trim();

        if (!titulo || !empresa || !segmento || !vertical || !descripcion) {
          skipped.push({
            row: rowNum,
            reason:
              'Faltan campos obligatorios (titulo, empresa_nombre, segmento, vertical, descripcion).',
          });
          continue;
        }

        if (!SEGMENTOS.includes(segmento as (typeof SEGMENTOS)[number])) {
          skipped.push({
            row: rowNum,
            reason: `Segmento inválido: ${segmento}`,
          });
          continue;
        }

        if (!VERTICALES.includes(vertical as (typeof VERTICALES)[number])) {
          skipped.push({
            row: rowNum,
            reason: `Vertical inválida: ${vertical}`,
          });
          continue;
        }

        try {
          await crearOuvDirecta({
            titulo,
            empresa_nombre: empresa,
            segmento,
            vertical,
            descripcion,
            ...(row.account_id?.trim()
              ? { account_id: row.account_id.trim() }
              : {}),
          });
          created += 1;
        } catch (err) {
          skipped.push({
            row: rowNum,
            reason:
              err instanceof Error ? err.message : 'No se pudo crear la OUV.',
          });
        }
      }

      setResult({ created, skipped });
      setStep('done');
      onDone?.();
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : 'No se pudo leer el archivo.',
      );
      setStep('upload');
    }
  }

  return (
    <ModalShell title="Carga masiva de OUV" onClose={onClose} size="wide">
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
                  {OUV_CSV_FIELDS.map((field, index) => (
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
            {progress || 'Procesando importación…'}
          </p>
        ) : null}

        {step === 'done' && result ? (
          <>
            <p className="text-sm text-ink">
              Importación completada:{' '}
              <span className="font-bold">{result.created}</span> OUVs creadas,{' '}
              {result.skipped.length} omitidas.
            </p>
            {result.skipped.length > 0 ? (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted">
                {result.skipped.map((row) => (
                  <li key={`${row.row}-${row.reason}`}>
                    Fila {row.row}: {row.reason}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex justify-end">
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
