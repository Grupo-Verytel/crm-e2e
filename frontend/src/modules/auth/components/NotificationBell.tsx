import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { formatRelative } from '../../../lib/format';
import { useNotifications } from '../context/NotificationsProvider';

function hrefForNotification(eventType: string, entityId: string): string | null {
  if (
    eventType === 'lead.mql_aprobado' ||
    eventType === 'sql.creado' ||
    eventType === 'sql.cita_reagendada'
  ) {
    return '/qualification';
  }
  if (eventType === 'sql.asignado') {
    return `/qualification/sqls/${entityId}`;
  }
  return null;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { items, unread, refresh, marcarLeida } = useNotifications();
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

  async function handleOpenItem(item: (typeof items)[number]) {
    try {
      await marcarLeida(item.notification_id);
    } catch {
      // Navigation still proceeds.
    }
    setOpen(false);
    const href = hrefForNotification(item.event_type, item.entity_id);
    if (href) {
      navigate(href);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          void refresh();
        }}
        className="icon-btn relative grid h-9 w-9 place-items-center rounded"
        aria-label={
          unread > 0
            ? `Notificaciones, ${unread} sin leer`
            : 'Notificaciones'
        }
        aria-expanded={open}
      >
        <Bell size={18} strokeWidth={1.75} />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 min-w-4 rounded-full bg-turquoise px-1 text-center text-[10px] font-bold leading-4 text-ink">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded border border-border bg-surface shadow-card">
          <div className="border-b border-border px-3 py-2">
            <p className="text-xs font-bold text-ink">Notificaciones</p>
          </div>

          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">
              No hay notificaciones.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((item) => (
                <li key={item.notification_id}>
                  <button
                    type="button"
                    onClick={() => void handleOpenItem(item)}
                    className="w-full border-b border-border px-3 py-3 text-left hover:bg-bg"
                  >
                    <p className="text-sm font-bold text-ink">{item.titulo}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-ink">
                      {item.mensaje}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">
                      {formatRelative(item.created_at)} · nueva
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
