import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Pencil, Settings, XCircle } from 'lucide-react';

type Props = {
  editingOuv?: boolean;
  onEditar: () => void;
  onAvanzar: () => void;
  onRetroceder: () => void;
  onCerrar: () => void;
};

const menuItemClass =
  'flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm font-bold text-ink hover:bg-bg first:border-t-0';

export function OuvConfigMenu({
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
            onClick={() => pick(onEditar)}
          >
            <Pencil size={16} strokeWidth={2} aria-hidden />
            {editingOuv ? 'Finalizar edición' : 'Editar OUV'}
          </button>
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            onClick={() => pick(onAvanzar)}
          >
            <ArrowRight size={16} strokeWidth={2} aria-hidden />
            Avanzar zona
          </button>
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            onClick={() => pick(onRetroceder)}
          >
            <ArrowLeft size={16} strokeWidth={2} aria-hidden />
            Retroceder
          </button>
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
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
