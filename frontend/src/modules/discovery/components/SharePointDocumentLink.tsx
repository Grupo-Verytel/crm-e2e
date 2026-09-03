import { useState } from 'react';
import { Copy, ExternalLink, FileText } from 'lucide-react';
import { sharePointDocumentName } from '../lib/sharepoint-document';
import { ModalShell } from './ModalShell';
import { ghostButtonClass, labelClass, primaryButtonClass } from './ui';

export function SharePointDocumentLink({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  const name = sharePointDocumentName(url);

  return (
    <>
      <div className="rounded border border-border bg-bg p-3">
        <p className="text-xs text-muted">Documento SharePoint</p>
        <button
          type="button"
          className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-accent hover:underline"
          onClick={() => setOpen(true)}
        >
          <ExternalLink size={14} strokeWidth={2} aria-hidden />
          {name}
        </button>
      </div>
      {open ? (
        <SharePointDocumentModal
          url={url}
          name={name}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function SharePointDocumentModal({
  url,
  name,
  onClose,
}: {
  url: string;
  name: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

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
    <ModalShell title="Documento SharePoint" onClose={onClose} size="wide">
      <h3 className="mb-4 text-base font-bold text-ink">{name}</h3>

      <div className="mb-4 flex flex-col items-center justify-center rounded border border-border bg-bg px-6 py-10 text-center">
        <span className="mb-3 grid h-16 w-16 place-items-center rounded-full bg-accent/15 text-accent">
          <FileText size={28} strokeWidth={1.75} aria-hidden />
        </span>
        <p className="max-w-md text-sm text-muted">
          Vista previa simulada del documento. En producción se embebería el
          visor de SharePoint / Office Online.
        </p>
        <p className="mt-4 w-full break-all rounded bg-surface px-3 py-2 text-left text-xs text-ink">
          {url}
        </p>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={ghostButtonClass} onClick={() => void copyLink()}>
          <span className="inline-flex items-center gap-1.5">
            <Copy size={14} strokeWidth={2} aria-hidden />
            {copied ? 'Copiado' : 'Copiar link'}
          </span>
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={primaryButtonClass}
        >
          <span className="inline-flex items-center gap-1.5">
            <ExternalLink size={14} strokeWidth={2} aria-hidden />
            Abrir en SharePoint
          </span>
        </a>
      </div>
    </ModalShell>
  );
}
