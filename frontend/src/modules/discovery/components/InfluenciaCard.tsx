import { Plus } from 'lucide-react';
import type { OuvContacto, OuvInfluencia } from '../api/ouvs-api';
import {
  INFLUENCIA_ESTADO_DOT,
  INFLUENCIA_TIPO_LABEL,
  type InfluenciaEstado,
  type InfluenciaTipo,
} from '../lib/ouv-vocab';

type Props = {
  tipo: InfluenciaTipo;
  rows: OuvInfluencia[];
  contactos: OuvContacto[];
  countsForFilter: boolean;
  selected: boolean;
  onSelect: (tipo: InfluenciaTipo) => void;
};

export function contactInitials(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export function InfluenciaCard({
  tipo,
  rows,
  contactos,
  countsForFilter,
  selected,
  onSelect,
}: Props) {
  const label = INFLUENCIA_TIPO_LABEL[tipo] ?? tipo;
  const assigned = rows
    .map((row) => contactos.find((c) => c.contacto_ouv_id === row.contacto_ouv_id))
    .filter((c): c is OuvContacto => Boolean(c));
  const empty = assigned.length === 0;
  const shown = assigned.slice(0, 3);
  const extra = assigned.length - shown.length;
  const countLabel =
    assigned.length === 1 ? '1 contacto' : `${assigned.length} contactos`;

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={empty ? `${label}. Sin asignar` : `${label}. ${countLabel}`}
      onClick={() => onSelect(tipo)}
      className={[
        'flex w-full min-w-0 cursor-pointer flex-col items-center rounded-lg border px-2 py-3 text-center outline-none',
        'focus-visible:ring-2 focus-visible:ring-accent',
        countsForFilter ? 'border-semaphore-verde' : '',
        selected
          ? 'border-solid bg-surface'
          : 'bg-bg/60 hover:border-border',
        selected || countsForFilter ? '' : 'border-transparent',
        selected && !countsForFilter ? 'border-border' : '',
      ].join(' ')}
    >
      {empty ? (
        <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-muted text-muted">
          <Plus size={18} strokeWidth={2.25} aria-hidden />
        </span>
      ) : (
        <span className="flex h-14 items-center justify-center">
          {shown.map((contact, index) => (
            <span
              key={contact.contacto_ouv_id}
              className="grid h-10 w-10 place-items-center rounded-full border-2 border-surface bg-bg text-xs font-bold text-ink"
              style={{ marginLeft: index === 0 ? 0 : -10 }}
            >
              {contactInitials(contact.name)}
            </span>
          ))}
          {extra > 0 ? (
            <span
              className="grid h-10 w-10 place-items-center rounded-full border-2 border-surface bg-bg text-xs font-bold text-muted"
              style={{ marginLeft: -10 }}
            >
              +{extra}
            </span>
          ) : null}
        </span>
      )}
      <span className="mt-2 w-full truncate text-sm font-bold text-ink">
        {label}
      </span>
      <span
        className={`w-full truncate text-xs ${empty ? 'italic text-muted' : 'text-muted'}`}
      >
        {empty ? 'Sin asignar' : countLabel}
      </span>
      {!empty ? (
        <span className="mt-1 flex items-center justify-center gap-1" aria-hidden>
          {rows.map((row) => (
            <span
              key={row.influencia_id}
              className={`h-2 w-2 rounded-full ${INFLUENCIA_ESTADO_DOT[row.estado as InfluenciaEstado] ?? INFLUENCIA_ESTADO_DOT.SinEvaluar}`}
            />
          ))}
        </span>
      ) : null}
    </button>
  );
}
