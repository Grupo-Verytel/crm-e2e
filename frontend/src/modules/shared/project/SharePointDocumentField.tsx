import { useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';

type Props = {
  url: string;
  nombre: string;
};

/** Filename as SharePoint link + copy control on the right (Preventa solicitudes). */
export function SharePointDocumentField({ url, nombre }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="group relative w-full max-w-full">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-9 w-full max-w-full items-center gap-2 rounded border border-border bg-surface px-3 py-2 pr-10 text-left text-sm font-bold text-accent hover:underline"
      >
        <ExternalLink size={15} aria-hidden />
        <span className="truncate text-accent">{nombre}</span>
      </a>
      <button
        type="button"
        className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-muted opacity-0 transition-opacity hover:text-accent group-hover:opacity-100 focus-visible:opacity-100"
        aria-label={copied ? 'Enlace copiado' : 'Copiar enlace del documento'}
        title={copied ? 'Copiado' : 'Copiar enlace'}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void handleCopy();
        }}
      >
        <Copy size={15} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
