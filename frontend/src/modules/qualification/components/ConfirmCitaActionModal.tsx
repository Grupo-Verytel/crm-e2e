import { X } from 'lucide-react';
import { ghostButtonClass, primaryButtonClass } from './ui';

type Props = {
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmCitaActionModal({
  title,
  message,
  confirmLabel,
  busy = false,
  error,
  onClose,
  onConfirm,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-cita-title"
    >
      <div className="w-full max-w-md rounded bg-surface shadow-card">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <h2 id="confirm-cita-title" className="text-base font-bold text-ink">
            {title}
          </h2>
          <button
            type="button"
            className="icon-btn grid h-8 w-8 shrink-0 place-items-center rounded"
            aria-label="Cerrar"
            disabled={busy}
            onClick={onClose}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-ink">{message}</p>
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={ghostButtonClass}
              disabled={busy}
              onClick={onClose}
            >
              Volver
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={busy}
              onClick={onConfirm}
            >
              {busy ? 'Guardando…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
