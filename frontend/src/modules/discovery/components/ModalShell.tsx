import type { ReactNode } from 'react';

export function ModalShell({
  title,
  onClose,
  children,
  size = 'default',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'default' | 'wide';
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={[
          'max-h-[90vh] w-full overflow-y-auto rounded bg-surface p-6 shadow-card',
          size === 'wide' ? 'max-w-3xl' : 'max-w-lg',
        ].join(' ')}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
            aria-label="Cerrar"
          >
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
