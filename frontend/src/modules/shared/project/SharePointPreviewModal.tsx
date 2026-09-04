import { useState } from 'react';
import { Copy, ExternalLink, FileText, X } from 'lucide-react';
import { ghostButtonClass, primaryButtonClass } from './ui';

type Props = {
  open: boolean;
  title: string;
  url: string;
  onClose: () => void;
};

/** Modal de preview SharePoint (mock) + opción de copiar / abrir en SharePoint. */
export function SharePointPreviewModal({ open, title, url, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded bg-surface shadow-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sp-preview-title"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-muted">Documento SharePoint</p>
            <h2
              id="sp-preview-title"
              className="truncate text-base font-bold text-ink"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            className={ghostButtonClass}
            onClick={onClose}
            aria-label="Cerrar vista previa"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-bg p-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10 text-accent">
            <FileText size={36} strokeWidth={1.5} aria-hidden />
          </div>
          <p className="max-w-md text-center text-sm text-muted">
            Vista previa simulada del documento. En producción se embebería el
            visor de SharePoint / Office Online.
          </p>
          <p className="max-w-full truncate rounded border border-border bg-surface px-3 py-2 font-mono text-xs text-ink">
            {url}
          </p>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            className={ghostButtonClass}
            onClick={() => void copyLink()}
          >
            <span className="inline-flex items-center gap-2">
              <Copy size={15} aria-hidden />
              {copied ? 'Copiado' : 'Copiar link'}
            </span>
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={primaryButtonClass}
          >
            <span className="inline-flex items-center gap-2">
              <ExternalLink size={15} aria-hidden />
              Abrir en SharePoint
            </span>
          </a>
        </footer>
      </div>
    </div>
  );
}
