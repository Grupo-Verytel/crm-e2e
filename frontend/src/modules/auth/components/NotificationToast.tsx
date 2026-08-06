import { useNotifications } from '../context/NotificationsProvider';

/** Auto-hide toast for push notifications (spec §7.3). */
export function NotificationToast() {
  const { toast, dismissToast } = useNotifications();

  if (!toast) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-80 rounded border border-border bg-surface p-4 shadow-card"
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-ink">{toast.titulo}</p>
          <p className="mt-1 line-clamp-3 text-sm text-muted">{toast.mensaje}</p>
        </div>
        <button
          type="button"
          onClick={dismissToast}
          className="text-xs text-muted hover:text-ink"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
