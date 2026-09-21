import { Plus } from 'lucide-react';
import type { OuvContacto, OuvInfluencia } from '../api/ouvs-api';
import {
  INFLUENCIA_ESTADO_LABEL,
  INFLUENCIA_TIPO_LABEL,
  influenciaAvatarRingClass,
  type InfluenciaEstado,
  type InfluenciaTipo,
} from '../lib/ouv-vocab';

type Props = {
  tipo: InfluenciaTipo;
  inf: OuvInfluencia | undefined;
  assignedContact: OuvContacto | undefined;
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
  inf,
  assignedContact,
  selected,
  onSelect,
}: Props) {
  const label = INFLUENCIA_TIPO_LABEL[tipo] ?? tipo;
  const estado =
    (inf?.estado as InfluenciaEstado | undefined) ?? 'SinEvaluar';
  const estadoLabel = INFLUENCIA_ESTADO_LABEL[estado];
  const hasContact = Boolean(assignedContact);
  const contactName = assignedContact?.name ?? 'Sin asignar';
  const ringClass = influenciaAvatarRingClass(estado, hasContact);

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${label}. ${contactName}. Estado: ${estadoLabel}`}
      onClick={() => onSelect(tipo)}
      className={[
        'flex w-full min-w-0 cursor-pointer flex-col items-center rounded-lg border px-2 py-3 text-center outline-none',
        'focus-visible:ring-2 focus-visible:ring-accent',
        selected
          ? 'border-solid border-border bg-surface'
          : 'border-transparent bg-bg/60 hover:border-border',
      ].join(' ')}
    >
      <span
        className={[
          'grid h-14 w-14 place-items-center rounded-full border-2 text-sm font-bold',
          ringClass,
        ].join(' ')}
        title={`Estado: ${estadoLabel}`}
      >
        {assignedContact ? (
          contactInitials(assignedContact.name)
        ) : (
          <Plus size={18} strokeWidth={2.25} aria-hidden />
        )}
      </span>
      <span className="mt-2 w-full truncate text-sm font-bold text-ink">
        {label}
      </span>
      <span
        className={`w-full truncate text-xs ${hasContact ? 'text-muted' : 'italic text-muted'}`}
      >
        {contactName}
      </span>
    </button>
  );
}
