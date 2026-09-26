import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

export function ModalShell({
  title,
  onClose,
  children,
  size = 'default',
  headerAside,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'default' | 'wide' | 'compact';
  /** Extra header content (e.g. a status badge on Preventa detail). */
  headerAside?: ReactNode;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Con el modal abierto la página de atrás no scrollea: en pantallas bajas el
  // scroll del contenido se encadenaba al body y el fondo se movía solo.
  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  let maxWidthClass = 'max-w-lg';
  if (size === 'wide') {
    maxWidthClass = 'max-w-3xl';
  } else if (size === 'compact') {
    maxWidthClass = 'max-w-[33.6rem]';
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={[
          'flex max-h-[90vh] w-full flex-col rounded bg-surface shadow-card transition-[max-width] duration-200',
          maxWidthClass,
        ].join(' ')}
      >
        <div className="flex shrink-0 items-start gap-2 px-6 pb-4 pt-6">
          <h2 className="min-w-0 shrink-0 text-base font-bold text-ink">
            {title}
          </h2>
          {headerAside ? (
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
              {headerAside}
            </div>
          ) : (
            <div className="flex-1" aria-hidden={true} />
          )}
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted hover:bg-bg hover:text-ink"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}
