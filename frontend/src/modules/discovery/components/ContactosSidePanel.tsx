import { useEffect } from 'react';
import { Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import type { OuvContacto } from '../api/ouvs-api';
import {
  badgeClass,
  ghostButtonClass,
  primaryButtonClass,
} from './ui';

function initials(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

type Props = {
  open: boolean;
  contactos: OuvContacto[];
  influenciaByContacto: Map<string, string[]>;
  editable: boolean;
  onClose: () => void;
  onAdd: () => void;
  onEdit: (contacto: OuvContacto) => void;
  onDelete: (contacto: OuvContacto) => void;
};

/**
 * Right-side sheet dedicated to contact CRUD.
 * Keeps the OUV detail page focused on influencias / presupuesto.
 */
export function ContactosSidePanel({
  open,
  contactos,
  influenciaByContacto,
  editable,
  onClose,
  onAdd,
  onEdit,
  onDelete,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-ink/25"
        aria-label="Cerrar panel de contactos"
        onClick={onClose}
      />
      <aside
        className="relative z-10 flex h-full w-full max-w-md flex-col bg-surface shadow-card"
        role="dialog"
        aria-modal="true"
        aria-label="Contactos de la OUV"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Users size={18} className="text-brand" strokeWidth={2} />
              <h2 className="text-base font-bold text-ink">Contactos</h2>
              <span className="rounded bg-bg px-1.5 py-0.5 text-xs font-bold text-muted">
                {contactos.length}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Personas de esta OUV. Asígnelas luego en Influencias.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded text-muted hover:bg-bg hover:text-ink"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        <div className="shrink-0 border-b border-border px-4 py-3">
          {editable ? (
            <button
              type="button"
              className={`${primaryButtonClass} w-full`}
              onClick={onAdd}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Plus size={16} strokeWidth={2.5} />
                Agregar contacto
              </span>
            </button>
          ) : (
            <p className="text-xs text-muted">Solo lectura</p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {contactos.length === 0 ? (
            <div className="px-3 py-10 text-center">
              <p className="text-sm font-bold text-ink">Sin contactos aún</p>
              <p className="mt-1 text-xs text-muted">
                Agrega decisores o técnicos para vincularlos a influencias.
              </p>
              {editable ? (
                <button
                  type="button"
                  className={`${ghostButtonClass} mt-4`}
                  onClick={onAdd}
                >
                  Agregar el primero
                </button>
              ) : null}
            </div>
          ) : (
            <ul>
              {contactos.map((c) => {
                const roles = influenciaByContacto.get(c.contacto_ouv_id) ?? [];
                const meta = [c.cargo, c.email, c.telefono]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <li
                    key={c.contacto_ouv_id}
                    className="rounded px-2 py-2.5 hover:bg-bg"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand"
                        aria-hidden
                      >
                        {initials(c.nombre)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">
                          {c.nombre}
                        </p>
                        {meta ? (
                          <p
                            className="mt-0.5 truncate text-xs text-muted"
                            title={meta}
                          >
                            {meta}
                          </p>
                        ) : null}
                        {roles.length > 0 ? (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {roles.map((role) => (
                              <span
                                key={role}
                                className={`${badgeClass} bg-brand/10 text-brand`}
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-muted">
                            Sin influencia asignada
                          </p>
                        )}
                        {c.notas ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted">
                            {c.notas}
                          </p>
                        ) : null}
                      </div>
                      {editable ? (
                        <div className="flex shrink-0 gap-0.5">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded text-muted hover:bg-surface hover:text-ink"
                            aria-label={`Editar ${c.nombre}`}
                            onClick={() => onEdit(c)}
                          >
                            <Pencil size={15} strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded text-muted hover:bg-surface hover:text-danger"
                            aria-label={`Eliminar ${c.nombre}`}
                            onClick={() => onDelete(c)}
                          >
                            <Trash2 size={15} strokeWidth={2} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
