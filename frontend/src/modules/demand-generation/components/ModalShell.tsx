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

  // Con el modal abierto la página de atrás no scrollea: en pantallas bajas el
  // scroll del contenido se encadenaba al body y el fondo se movía solo.
  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={[
          // Columna: el encabezado queda fijo y solo scrollea el contenido.
          'flex max-h-[90vh] w-full flex-col rounded bg-surface shadow-card',
          size === 'wide' ? 'max-w-5xl' : 'max-w-lg',
        ].join(' ')}
      >
        <div className="shrink-0 px-6 pb-4 pt-6">
          <h2 className="text-base font-bold text-ink">{title}</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}
