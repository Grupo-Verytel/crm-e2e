import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Pencil, Settings, XCircle } from 'lucide-react';

type Props = {
  /** Habilita las acciones que exigen ser dueño y OUV en curso. */
  canEditWorkflow: boolean;
  /** Se muestra "Finalizar edición" en vez de "Editar OUV" cuando está en true. */
  editingOuv?: boolean;
  onEditar: () => void;
  onAvanzar: () => void;
  onRetroceder: () => void;
  onCerrar: () => void;
};

const menuItemClass =
  'flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm font-bold text-ink first:border-t-0 hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

/**
 * Menú de acciones de la cabecera de una OUV. Reemplaza el popover ad-hoc que
 * vivía dentro de `OuvDetailHeader`; los ítems de workflow (avanzar / retroceder /
 * cerrar) se muestran deshabilitados cuando el usuario no puede tocarlos, en vez
 * de esconderse — así el menú no cambia de tamaño según el rol.
 */
export function OuvConfigMenu({
  canEditWorkflow,
  editingOuv = false,
  onEditar,
  onAvanzar,
  onRetroceder,
  onCerrar,
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

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function pick(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="icon-btn grid h-9 w-9 place-items-center rounded"
        aria-label="Acciones de la OUV"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <Settings size={18} strokeWidth={1.75} />
      </button>

      {open ? (
        <div
          className="absolute right-0 z-40 mt-2 min-w-[12rem] overflow-hidden rounded border border-border bg-surface shadow-card"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            disabled={!canEditWorkflow}
            onClick={() => pick(onEditar)}
          >
            <Pencil size={16} strokeWidth={2} aria-hidden />
            {editingOuv ? 'Finalizar edición' : 'Editar OUV'}
          </button>
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            disabled={!canEditWorkflow}
            onClick={() => pick(onAvanzar)}
          >
            <ArrowRight size={16} strokeWidth={2} aria-hidden />
            Avanzar zona
          </button>
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            disabled={!canEditWorkflow}
            onClick={() => pick(onRetroceder)}
          >
            <ArrowLeft size={16} strokeWidth={2} aria-hidden />
            Retroceder
          </button>
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            disabled={!canEditWorkflow}
            onClick={() => pick(onCerrar)}
          >
            <XCircle size={16} strokeWidth={2} aria-hidden />
            Cerrar OUV
          </button>
        </div>
      ) : null}
    </div>
  );
}
