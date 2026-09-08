import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Pencil, Settings, Trash2 } from 'lucide-react';

type Props = {
  canEdit?: boolean;
  canAvanzar?: boolean;
  canDelete?: boolean;
  onEditar: () => void;
  onAvanzar?: () => void;
  onEliminar: () => void;
};

const menuItemClass =
  'flex w-full items-center gap-2 whitespace-nowrap border-t border-border px-3 py-2 text-left text-sm font-bold text-ink hover:bg-bg first:border-t-0';

/** Gear menu for lead detail — mirrors OuvConfigMenu. */
export function LeadConfigMenu({
  canEdit = true,
  canAvanzar = false,
  canDelete = true,
  onEditar,
  onAvanzar,
  onEliminar,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  function pick(action: () => void) {
    setOpen(false);
    action();
  }

  if (!canEdit && !canAvanzar && !canDelete) {
    return null;
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="icon-btn grid h-9 w-9 place-items-center rounded"
        aria-label="Acciones del lead"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <Settings size={18} strokeWidth={1.75} />
      </button>

      {open ? (
        <div
          className="absolute right-0 z-40 mt-2 min-w-0 overflow-hidden rounded border border-border bg-surface shadow-card"
          role="menu"
        >
          {canEdit ? (
            <button
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={() => pick(onEditar)}
            >
              <Pencil size={16} strokeWidth={2} aria-hidden />
              Editar
            </button>
          ) : null}
          {canAvanzar && onAvanzar ? (
            <button
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={() => pick(onAvanzar)}
            >
              <ArrowRight size={16} strokeWidth={2} aria-hidden />
              Avanzar zona
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={() => pick(onEliminar)}
            >
              <Trash2 size={16} strokeWidth={2} aria-hidden />
              Eliminar
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
