import { useEffect, type ReactNode } from 'react';

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
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
        <div className="mb-4">
          <h2 className="text-base font-bold text-ink">{title}</h2>
        </div>
        {children}
      </div>
    </div>
  );
}
