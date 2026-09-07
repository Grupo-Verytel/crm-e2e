import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Ouv } from '../api/ouvs-api';
import type { OuvDetailExtensions } from '../lib/ouv-detail-extensions';
import { buildOuvMetaFields } from '../lib/ouv-detail-meta';
import { GapBadge, ResultadoBadge } from './OuvBadges';
import { cardClass } from './ui';

type Props = {
  ouv: Ouv;
  extensions?: OuvDetailExtensions;
  footer?: ReactNode;
  /** Default false — metadata grid starts collapsed. */
  defaultExpanded?: boolean;
};

/** Read-only OUV header — collapsible metadata (default compressed). */
export function OuvReadonlyHeaderCard({
  ouv,
  extensions = {},
  footer,
  defaultExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const readFields = buildOuvMetaFields(ouv, extensions);

  return (
    <header className={`${cardClass} mb-4 overflow-hidden`}>
      <button
        type="button"
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-bg/40"
        aria-expanded={expanded}
        aria-controls="ouv-header-details"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-ink">{ouv.titulo}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ResultadoBadge resultado={ouv.resultado} />
            <span className="rounded bg-bg px-2 py-0.5 text-xs font-bold text-ink">
              {ouv.origen_via === 'directa' ? 'Directa' : 'Desde SQL'}
            </span>
            {ouv.tiene_gap ? <GapBadge /> : null}
          </div>
          {ouv.descripcion ? (
            <p className="mt-3 text-sm text-muted">{ouv.descripcion}</p>
          ) : null}
        </div>
        <span
          className="icon-btn mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded"
          aria-hidden
        >
          {expanded ? (
            <ChevronUp size={20} strokeWidth={2} />
          ) : (
            <ChevronDown size={20} strokeWidth={2} />
          )}
        </span>
        <span className="sr-only">
          {expanded ? 'Comprimir información OUV' : 'Desplegar información OUV'}
        </span>
      </button>

      {expanded ? (
        <div id="ouv-header-details" className="border-t border-border px-4 pb-4 pt-4">
          <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {readFields.map((field) => (
              <div key={field.label}>
                <dt className="text-xs font-bold text-muted">{field.label}</dt>
                <dd className="mt-0.5 break-words font-medium text-ink">
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
          {footer ? <div className="mt-3">{footer}</div> : null}
        </div>
      ) : null}
    </header>
  );
}
