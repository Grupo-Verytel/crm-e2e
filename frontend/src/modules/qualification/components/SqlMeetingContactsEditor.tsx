import { Plus, X } from 'lucide-react';
import type { MeetingContactDraft } from '../lib/sql-assignment-scheduling';
import { inputClass, labelClass } from './ui';

type Props = {
  contacts: MeetingContactDraft[];
  selectedId: string | null;
  canAdd: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<MeetingContactDraft>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
};

function contactLabel(index: number): string {
  return index === 0 ? 'Contacto principal' : `Contacto ${index + 1}`;
}

function contactInitials(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '+';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function contactPreviewLine(contact: MeetingContactDraft): string {
  const name = contact.nombre.trim();
  const cargo = contact.cargo.trim();
  if (name && cargo) return `${name} · ${cargo}`;
  return name || 'Sin asignar';
}

export function SqlMeetingContactsEditor({
  contacts,
  selectedId,
  canAdd,
  onSelect,
  onChange,
  onAdd,
  onRemove,
}: Props) {
  const selected =
    contacts.find((contact) => contact.id === selectedId) ?? contacts[0] ?? null;
  const selectedIndex = selected
    ? contacts.findIndex((contact) => contact.id === selected.id)
    : -1;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {contacts.map((contact, index) => {
          const isSelected = contact.id === selected?.id;
          const hasName = Boolean(contact.nombre.trim());
          return (
            <button
              key={contact.id}
              type="button"
              onClick={() => onSelect(contact.id)}
              className={[
                'flex min-w-30 shrink-0 flex-col items-center gap-2 rounded border px-3 py-3 text-center transition-colors',
                isSelected
                  ? 'border-accent bg-accent/10 ring-2 ring-accent/30'
                  : 'border-border bg-surface hover:border-accent/50 hover:bg-bg',
              ].join(' ')}
            >
              <span
                className={[
                  'grid h-11 w-11 place-items-center rounded-full text-xs font-bold',
                  hasName
                    ? 'border border-border bg-bg text-ink'
                    : 'border border-dashed border-muted text-muted',
                ].join(' ')}
              >
                {contactInitials(contact.nombre)}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
                {contactLabel(index)}
              </span>
              <span
                className={[
                  'line-clamp-2 w-full text-xs',
                  hasName ? 'font-bold text-ink' : 'italic text-muted',
                ].join(' ')}
              >
                {hasName ? contact.nombre.trim() : 'Sin asignar'}
              </span>
            </button>
          );
        })}

        {canAdd ? (
          <button
            type="button"
            onClick={onAdd}
            className="flex min-w-30 shrink-0 flex-col items-center justify-center gap-2 rounded border border-dashed border-border bg-bg px-3 py-3 text-center transition-colors hover:border-accent hover:bg-surface"
            aria-label="Agregar contacto"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full border border-dashed border-muted text-muted">
              <Plus size={18} strokeWidth={2} />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
              Nuevo
            </span>
            <span className="text-xs italic text-muted">Agregar</span>
          </button>
        ) : null}
      </div>

      {selected ? (
        <div className="rounded border border-border bg-bg p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-bg text-xs font-bold text-ink">
                {contactInitials(selected.nombre)}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-muted">
                  {contactLabel(selectedIndex)}
                </p>
                <p className="mt-1 truncate text-sm font-bold uppercase text-ink">
                  {contactPreviewLine(selected)}
                </p>
                {selected.email.trim() || selected.telefono.trim() ? (
                  <p className="mt-1 truncate text-xs text-muted">
                    {[selected.email.trim(), selected.telefono.trim()]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                ) : null}
              </div>
            </div>
            {selectedIndex > 0 ? (
              <button
                type="button"
                className="icon-btn grid h-8 w-8 shrink-0 place-items-center rounded text-muted hover:text-danger"
                aria-label="Quitar contacto"
                onClick={() => onRemove(selected.id)}
              >
                <X size={16} strokeWidth={2} />
              </button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor={`sql-contact-name-${selected.id}`}>
                Nombre
              </label>
              <input
                id={`sql-contact-name-${selected.id}`}
                className={inputClass}
                value={selected.nombre}
                onChange={(event) =>
                  onChange(selected.id, { nombre: event.target.value })
                }
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`sql-contact-cargo-${selected.id}`}>
                Cargo
              </label>
              <input
                id={`sql-contact-cargo-${selected.id}`}
                className={inputClass}
                value={selected.cargo}
                onChange={(event) =>
                  onChange(selected.id, { cargo: event.target.value })
                }
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`sql-contact-email-${selected.id}`}>
                Correo
              </label>
              <input
                id={`sql-contact-email-${selected.id}`}
                className={inputClass}
                type="email"
                value={selected.email}
                onChange={(event) =>
                  onChange(selected.id, { email: event.target.value })
                }
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`sql-contact-phone-${selected.id}`}>
                Teléfono
              </label>
              <input
                id={`sql-contact-phone-${selected.id}`}
                className={inputClass}
                value={selected.telefono}
                onChange={(event) =>
                  onChange(selected.id, { telefono: event.target.value })
                }
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
