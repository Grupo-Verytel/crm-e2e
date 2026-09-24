import { StickyNote, UserPlus, X } from 'lucide-react';
import { useId, useState } from 'react';
import type { OuvContacto, OuvInfluencia } from '../api/ouvs-api';
import {
  INFLUENCIA_ESTADO_LABEL,
  INFLUENCIA_TIPO_LABEL,
  type InfluenciaEstado,
  type InfluenciaTipo,
} from '../lib/ouv-vocab';
import { contactInitials } from './InfluenciaCard';
import { EstadoSegmentedControl } from './EstadoSegmentedControl';
import { ModalShell } from './ModalShell';
import { ghostButtonClass, primaryButtonClass } from './ui';

type Props = {
  tipo: InfluenciaTipo;
  rows: OuvInfluencia[];
  contactos: OuvContacto[];
  editable: boolean;
  savingId: string | null;
  onAddExisting: (contactoOuvId: string) => void;
  onCreateContact: () => void;
  onRate: (contactoOuvId: string, estado: InfluenciaEstado) => void;
  onRemove: (contactoOuvId: string, nombre: string) => void;
  onOpenNota: (contactoOuvId: string) => void;
};

export function InfluenciaDetallePanel({
  tipo,
  rows,
  contactos,
  editable,
  savingId,
  onAddExisting,
  onCreateContact,
  onRate,
  onRemove,
  onOpenNota,
}: Props) {
  const label = INFLUENCIA_TIPO_LABEL[tipo] ?? tipo;
  const atMax = rows.length >= 5;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<{
    contactoOuvId: string;
    nombre: string;
  } | null>(null);
  const assignedIds = new Set(rows.map((row) => row.contacto_ouv_id));
  const available = contactos.filter((c) => !assignedIds.has(c.contacto_ouv_id));
  const addTipId = useId();

  return (
    <div
      className="rounded-lg border border-border p-3"
      role="region"
      aria-label={`Detalle de influencia ${label}`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-ink">
          {label} · {rows.length}/5 contactos
        </p>
        {editable ? (
          <span className="group relative">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
              disabled={atMax}
              aria-describedby={atMax ? addTipId : undefined}
              onClick={() => setPickerOpen((open) => !open)}
            >
              <UserPlus size={14} aria-hidden />
              Agregar contacto existente
            </button>
            {atMax ? (
              <span
                id={addTipId}
                role="tooltip"
                className="pointer-events-none absolute right-0 top-full z-10 mt-1 hidden w-max max-w-xs rounded border border-border bg-surface px-2 py-1 text-xs text-ink shadow-card group-hover:block group-focus-within:block [@media(hover:none)]:hidden"
              >
                Máximo 5 contactos por influencia
              </span>
            ) : null}
          </span>
        ) : null}
      </div>

      {pickerOpen && editable && !atMax ? (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <select
            className="h-8 rounded border border-border bg-bg px-2 text-xs text-ink"
            defaultValue=""
            aria-label={`Elegir contacto para ${label}`}
            onChange={(event) => {
              const value = event.target.value;
              if (!value) return;
              onAddExisting(value);
              setPickerOpen(false);
            }}
          >
            <option value="">Elegir contacto</option>
            {available.map((c) => (
              <option key={c.contacto_ouv_id} value={c.contacto_ouv_id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="text-xs font-bold text-accent hover:underline"
            onClick={onCreateContact}
          >
            Agregar un nuevo contacto
          </button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-sm text-muted">Aún no hay contactos en esta influencia</p>
          {editable && !atMax ? (
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline"
              onClick={onCreateContact}
            >
              <UserPlus size={14} aria-hidden />
              Agregar un nuevo contacto
            </button>
          ) : null}
        </div>
      ) : (
        <ul>
          {rows.map((row) => {
            const contact = contactos.find(
              (c) => c.contacto_ouv_id === row.contacto_ouv_id,
            );
            const nombre = contact?.name ?? 'Contacto';
            const estado = (row.estado as InfluenciaEstado) ?? 'SinEvaluar';
            const noteId = `nota-tip-${row.influencia_id}`;
            return (
              <li
                key={row.influencia_id}
                className="flex items-center gap-2 border-t border-border py-2"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-bg text-xs font-bold text-ink">
                  {contactInitials(nombre)}
                </span>
                <p className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium text-ink">{nombre}</span>
                  {contact?.phone ? (
                    <span className="text-muted"> · {contact.phone}</span>
                  ) : null}
                </p>
                <EstadoSegmentedControl
                  compact
                  value={estado}
                  disabled={!editable || savingId === row.influencia_id}
                  onChange={(next) => onRate(row.contacto_ouv_id, next)}
                />
                <span className="group relative">
                  <button
                    type="button"
                    className={`grid h-8 w-8 place-items-center rounded outline-none focus-visible:ring-2 focus-visible:ring-accent ${row.notas ? 'text-accent' : 'text-muted'}`}
                    aria-label={row.notas ? `Nota de ${nombre}` : `Agregar nota de ${nombre}`}
                    aria-describedby={row.notas ? noteId : undefined}
                    onClick={() => onOpenNota(row.contacto_ouv_id)}
                  >
                    <StickyNote size={16} aria-hidden />
                  </button>
                  {row.notas ? (
                    <span
                      id={noteId}
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full right-0 z-10 mb-1 hidden max-w-xs rounded border border-border bg-surface p-2 text-left text-xs text-ink shadow-card line-clamp-3 group-hover:block group-focus-within:block [@media(hover:none)]:hidden"
                    >
                      {row.notas}
                    </span>
                  ) : null}
                </span>
                {editable ? (
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded text-muted hover:text-danger"
                    aria-label={`Quitar a ${nombre} de ${label}`}
                    onClick={() =>
                      setPendingRemove({
                        contactoOuvId: row.contacto_ouv_id,
                        nombre,
                      })
                    }
                  >
                    <X size={14} aria-hidden />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <p className="sr-only">{INFLUENCIA_ESTADO_LABEL.SinEvaluar}</p>
      {pendingRemove ? (
        <ModalShell
          title="Quitar contacto"
          onClose={() => setPendingRemove(null)}
          size="compact"
        >
          <p className="text-sm text-ink">
            ¿Quitar a {pendingRemove.nombre} de la influencia {label}?
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className={ghostButtonClass}
              onClick={() => setPendingRemove(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => {
                onRemove(pendingRemove.contactoOuvId, pendingRemove.nombre);
                setPendingRemove(null);
              }}
            >
              Quitar
            </button>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
