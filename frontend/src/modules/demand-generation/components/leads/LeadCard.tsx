import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { formatDateTime, formatRelative } from '../../../../lib/format';
import type { ChecklistProgress as Progress } from '../../hooks/useChecklistProgress';
import {
  CANAL_ORIGEN_LABEL,
  CHANNEL_ROUTES,
  KANBAN_COLUMNS,
  leadDisplayName,
} from '../../lib/lead-vocab';
import type { Lead } from '../../types';
import { ChecklistProgress } from './ChecklistProgress';
import { SegmentChip } from './SegmentChip';

function leadAccentId(lead: Lead): string {
  const raw = lead.lead_id.replace(/-/g, '').slice(0, 6).toUpperCase();
  return `SQL-${raw}`;
}

export function LeadCard({
  lead,
  draggable,
  onDragStart,
  onDragEnd,
  showChecklist = false,
  showRoute = false,
  checklistProgress,
  errorMessage,
  busy = false,
  onDiscard,
  /** Match OUV kanban card hierarchy (accent id → title → empresa). */
  variant = 'default',
}: {
  lead: Lead;
  draggable: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  showChecklist?: boolean;
  showRoute?: boolean;
  checklistProgress?: Progress | null | undefined;
  errorMessage?: string | null;
  busy?: boolean;
  onDiscard?: (lead: Lead) => void;
  variant?: 'default' | 'ouv';
}) {
  const isOuvStyle = variant === 'ouv';

  return (
    <div
      draggable={draggable && !busy}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', lead.lead_id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={[
        'group relative rounded border border-border bg-bg p-2 transition hover:border-accent',
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
        busy ? 'opacity-50' : '',
        errorMessage ? 'border-danger' : '',
      ].join(' ')}
    >
      {onDiscard ? (
        <button
          type="button"
          className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded text-muted opacity-0 transition hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
          title="Eliminar lead"
          aria-label={`Eliminar lead ${leadDisplayName(lead)}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDiscard(lead);
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <Trash2 size={15} strokeWidth={2} />
        </button>
      ) : null}

      <Link
        to={`/demand/leads/${lead.lead_id}`}
        onClick={(event) => event.stopPropagation()}
        className={['block', onDiscard ? 'pr-8' : ''].join(' ')}
      >
        {isOuvStyle ? (
          <>
            <p className="text-xs font-bold text-accent">{leadAccentId(lead)}</p>
            <p className="text-sm text-ink">{leadDisplayName(lead)}</p>
            <p className="text-xs text-muted">
              {lead.empresa_nombre}
              {lead.contacto_nombre ? ` · ${lead.contacto_nombre}` : ''}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-ink hover:text-accent">
              {leadDisplayName(lead)}
            </p>
            <p className="truncate text-xs text-muted">
              {lead.empresa_nombre}
              {lead.contacto_nombre ? ` · ${lead.contacto_nombre}` : ''}
            </p>
          </>
        )}
      </Link>

      {!isOuvStyle && showRoute ? (
        <div className="mt-2" title={CANAL_ORIGEN_LABEL[lead.canal_origen]}>
          <p className="truncate text-[11px] font-bold text-muted">
            {CANAL_ORIGEN_LABEL[lead.canal_origen]}
          </p>
          {CHANNEL_ROUTES[lead.canal_origen] ? (
            <div className="mt-1 flex items-center gap-1" aria-label="Ruta esperada">
              {KANBAN_COLUMNS.map((column) => {
                const applies = CHANNEL_ROUTES[lead.canal_origen]?.includes(
                  column.estado,
                );
                return (
                  <span
                    key={column.estado}
                    className={[
                      'h-1.5 w-1.5 rounded-full',
                      applies ? 'bg-accent' : 'bg-border opacity-50',
                    ].join(' ')}
                    title={`${column.label}${applies ? '' : ' — no aplica'}`}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-muted">Ruta TBD</p>
          )}
        </div>
      ) : null}

      {!isOuvStyle ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <SegmentChip segmento={lead.segmento} />
          <span
            className="text-xs text-muted"
            title={
              lead.fecha_ultima_interaccion
                ? formatDateTime(lead.fecha_ultima_interaccion)
                : undefined
            }
          >
            {lead.fecha_ultima_interaccion
              ? formatRelative(lead.fecha_ultima_interaccion)
              : 'Sin interacción'}
          </span>
        </div>
      ) : null}

      {showChecklist && !isOuvStyle ? (
        <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
          <span className="text-xs text-muted">Checklist</span>
          <ChecklistProgress progress={checklistProgress} />
        </div>
      ) : null}

      {busy ? <p className="mt-2 text-xs text-muted">Moviendo…</p> : null}

      {errorMessage ? (
        <p className="mt-2 text-xs text-danger">{errorMessage}</p>
      ) : null}
    </div>
  );
}
