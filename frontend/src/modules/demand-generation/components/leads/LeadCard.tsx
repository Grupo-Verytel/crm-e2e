import { Link } from 'react-router-dom';
import { formatDateTime, formatRelative } from '../../../../lib/format';
import type { ChecklistProgress as Progress } from '../../hooks/useChecklistProgress';
import type { Lead } from '../../types';
import { ChecklistProgress } from './ChecklistProgress';
import { SegmentChip } from './SegmentChip';

export function LeadCard({
  lead,
  draggable,
  onDragStart,
  onDragEnd,
  showChecklist = false,
  checklistProgress,
  errorMessage,
  busy = false,
}: {
  lead: Lead;
  draggable: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  showChecklist?: boolean;
  checklistProgress?: Progress | null | undefined;
  errorMessage?: string | null;
  busy?: boolean;
}) {
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
        'rounded border border-border bg-surface p-3 shadow-card transition',
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
        busy ? 'opacity-50' : '',
        errorMessage ? 'border-danger' : '',
      ].join(' ')}
    >
      <Link
        to={`/demand/leads/${lead.lead_id}`}
        onClick={(event) => event.stopPropagation()}
        className="block text-sm font-bold text-ink hover:text-brand"
      >
        {lead.empresa_nombre}
      </Link>
      <p className="truncate text-xs text-muted">{lead.contacto_nombre}</p>

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

      {showChecklist ? (
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
