import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, X } from 'lucide-react';
import { formatRelative } from '../../../lib/format';
import { useReminders } from '../../shared/reminders/RemindersProvider';
import {
  reminderEntityKind,
  type OuvReminder,
} from '../../shared/reminders/types';
import { useNotifications } from '../context/NotificationsProvider';

type PanelTab = 'notificaciones' | 'recordatorios';

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

function reminderHref(item: OuvReminder): string {
  if (reminderEntityKind(item) === 'Lead') {
    return `/qualification/sqls/${item.ouv_id}?tab=recordatorios`;
  }
  return `/opportunities/${item.ouv_id}?tab=recordatorios`;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { items, unread, refresh, marcarLeida } = useNotifications();
  const { dueReminders, upcomingReminders, dueCount, resolveReminder } =
    useReminders();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PanelTab>('notificaciones');
  const rootRef = useRef<HTMLDivElement>(null);
  const hasDueReminder = dueCount > 0;
  const reminderRows = [...dueReminders, ...upcomingReminders];

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  async function handleOpenNotification(item: (typeof items)[number]) {
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

  function handleOpenReminder(item: OuvReminder) {
    setOpen(false);
    navigate(reminderHref(item));
  }

  const badgeCount = hasDueReminder ? dueCount : unread;
  const tabClass = (active: boolean) =>
    [
      '-mb-px flex-1 border-b-2 px-3 py-2 text-xs transition-colors',
      active
        ? 'border-accent font-bold text-accent'
        : 'border-transparent text-muted hover:text-accent',
    ].join(' ');

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          void refresh();
        }}
        className={[
          'icon-btn relative grid h-9 w-9 place-items-center rounded',
          hasDueReminder ? 'bell-reminder-active' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label={
          hasDueReminder
            ? `Recordatorios, ${dueCount} pendientes`
            : unread > 0
              ? `Notificaciones, ${unread} sin leer`
              : 'Notificaciones'
        }
        aria-expanded={open}
      >
        <Bell
          size={18}
          strokeWidth={1.75}
          className="bell-reminder-icon"
        />
        {badgeCount > 0 ? (
          <span
            className={[
              'absolute right-1 top-1 min-w-4 rounded-full px-1 text-center text-[10px] font-bold leading-4',
              hasDueReminder
                ? 'bg-accent text-white'
                : 'bg-turquoise text-ink',
            ].join(' ')}
          >
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded border border-border bg-surface shadow-card">
          <div className="flex border-b border-border">
            <button
              type="button"
              className={tabClass(tab === 'notificaciones')}
              onClick={() => setTab('notificaciones')}
            >
              Notificaciones
              {unread > 0 ? ` (${unread})` : ''}
            </button>
            <button
              type="button"
              className={tabClass(tab === 'recordatorios')}
              onClick={() => setTab('recordatorios')}
            >
              Recordatorios
              {dueCount > 0 ? ` (${dueCount})` : ''}
            </button>
          </div>

          {tab === 'notificaciones' ? (
            items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted">
                No hay notificaciones.
              </p>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {items.map((item) => (
                  <li key={item.notification_id}>
                    <button
                      type="button"
                      onClick={() => void handleOpenNotification(item)}
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
            )
          ) : reminderRows.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">
              No hay recordatorios.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {reminderRows.map((item) => {
                const due = new Date(item.remind_at).getTime() <= Date.now();
                return (
                  <li
                    key={item.reminder_id}
                    className="flex items-start gap-2 border-b border-border px-3 py-3 hover:bg-bg"
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenReminder(item)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="text-sm font-bold text-ink">
                        {item.interaccion_titulo}
                      </p>
                      <p className="mt-0.5 text-sm text-ink">
                        {item.ouv_consecutivo}
                      </p>
                      <p
                        className={`mt-1 text-[11px] ${due ? 'font-bold text-accent' : 'text-muted'}`}
                      >
                        {due ? 'Vence ahora' : formatRelative(item.remind_at)}
                        {due ? ' · seguimiento' : ' · programado'}
                      </p>
                      <p className="mt-0.5 text-[11px] font-bold text-accent">
                        {reminderEntityKind(item)}
                      </p>
                    </button>
                    <div className="flex shrink-0 gap-1 pt-0.5">
                      <button
                        type="button"
                        className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-positive/15 hover:text-positive"
                        aria-label="Marcar como realizado"
                        title="Realizado"
                        onClick={() =>
                          resolveReminder(item.reminder_id, 'done')
                        }
                      >
                        <Check size={15} strokeWidth={2.25} />
                      </button>
                      <button
                        type="button"
                        className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-danger/10 hover:text-danger"
                        aria-label="Descartar de la bandeja"
                        title="Descartar"
                        onClick={() =>
                          resolveReminder(item.reminder_id, 'dismissed')
                        }
                      >
                        <X size={15} strokeWidth={2.25} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
