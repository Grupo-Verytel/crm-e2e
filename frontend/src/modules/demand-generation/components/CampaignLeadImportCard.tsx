import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import {
  downloadLeadImportTemplate,
  snapshotImportFile,
} from '../lib/lead-bulk-import';
import { loadLeadImportCatalog } from '../lib/lead-import-catalog';
import { cardClass, ghostButtonClass } from './ui';

type Props = {
  file: File | null;
  onFileChange: (file: File | null) => void;
};

export function CampaignLeadImportCard({ file, onFileChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function handleDownloadTemplate() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const catalog = await loadLeadImportCatalog();
      downloadLeadImportTemplate(catalog);
    } catch (error) {
      setDownloadError(
        error instanceof Error
          ? error.message
          : 'No se pudo descargar la plantilla.',
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className={`${cardClass} space-y-3 p-5`}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-bold text-ink">Importar leads (CSV o Excel)</h2>
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
      </div>
      <p className="text-xs text-muted">
        Usa la misma plantilla y las mismas reglas del cargue de leads. Puedes
        repetir empresa y NIT si cada fila trae un contacto distinto (nombre,
        cargo, email y teléfono): se crea un solo lead y cada fila queda como
        contacto. En esas filas, origen, canal, segmento, subsegmento y ciudad
        deben ser iguales. El segmento del archivo tiene que coincidir con el
        segmento objetivo de la campaña. La empresa debe existir en el CRM. El
        canal del lead queda como Generación de demanda (agencia).
      </p>
      {downloadError ? <p className="text-sm text-danger">{downloadError}</p> : null}
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
            if (!selected) {
              onFileChange(null);
              return;
            }
            setDownloadError(null);
            void snapshotImportFile(selected)
              .then(onFileChange)
              .catch((error: unknown) => {
                onFileChange(null);
                setDownloadError(
                  error instanceof Error
                    ? error.message
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
      </div>
    </div>
  );
}
