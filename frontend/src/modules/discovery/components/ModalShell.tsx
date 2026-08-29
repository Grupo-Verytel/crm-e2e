import type { ReactNode } from 'react';

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
  /** Replaces the default "Cerrar" control (e.g. status badge). */
  headerAside?: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={[
          'max-h-[90vh] w-full overflow-y-auto rounded bg-surface p-6 shadow-card transition-[max-width] duration-200',
          size === 'wide'
            ? 'max-w-3xl'
            : size === 'compact'
              ? 'max-w-[33.6rem]' /* ~30% narrower than wide (3xl) */
              : 'max-w-lg',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          {headerAside ?? (
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-muted hover:text-ink"
              aria-label="Cerrar"
            >
              Cerrar
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
