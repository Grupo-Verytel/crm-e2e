import { useEffect, type MouseEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';

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
  /** Extra a la izquierda de la X (p. ej. un badge de estado). */
  headerAside?: ReactNode;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={handleBackdrop}
    >
      <div
        className={[
          'max-h-[90vh] w-full overflow-y-auto rounded bg-surface p-6 shadow-card transition-[max-width] duration-200',
          size === 'wide'
            ? 'max-w-3xl'
            : size === 'compact'
              ? 'max-w-[33.6rem]' /* ~30% mas angosto que wide */
              : 'max-w-lg',
        ].join(' ')}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          <div className="flex shrink-0 items-center gap-2">
            {headerAside}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-muted hover:bg-bg hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Cerrar"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
