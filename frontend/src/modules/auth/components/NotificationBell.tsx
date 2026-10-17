import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { ReminderGroupTabs } from '../../../components/reminders/ReminderGroupTabs';
import { ReminderTrayList } from '../../../components/reminders/ReminderTrayList';
import {
  cancelReminder,
  completeReminder,
} from '../../../components/reminders/reminders-api';
import { reminderErrorMessage } from '../../../components/reminders/reminder-errors';
import type {
  BellReminderItem,
  ReminderTrayItem,
} from '../../../components/reminders/types';
import { useBellReminders } from '../../../components/reminders/useBellReminders';
import { formatRelative } from '../../../lib/format';
import { useNotifications } from '../context/NotificationsProvider';

type PanelTab = 'notificaciones' | 'recordatorios';

const TABS: PanelTab[] = ['notificaciones', 'recordatorios'];

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

function hrefForReminder(item: BellReminderItem): string | null {
  if (item.source_type === 'LEAD') {
    return `/demand/leads/${item.source_id}`;
  }
  if (item.source_type === 'SQL') {
    return `/qualification/sqls/${item.source_id}`;
  }
  if (item.source_type === 'OUV') {
    return `/opportunities/${item.source_id}?tab=recordatorios`;
  }
  return null;
}

function toTrayItem(item: BellReminderItem): ReminderTrayItem {
  return {
    reminder_id: item.reminder_id,
    event_at: item.event_at,
    note: item.note,
    status: item.status,
    completed_at: null,
    source_label: item.source_label,
  };
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { items, unread, refresh, marcarLeida, reminderSignal } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PanelTab>('notificaciones');
  const [actionError, setActionError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<PanelTab, HTMLButtonElement | null>>({
    notificaciones: null,
    recordatorios: null,
  });
  const reminders = useBellReminders({ open, reminderSignal });
  const dueReminders = reminders.counts.OVERDUE + reminders.counts.TODAY;

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

  function handleOpenReminder(item: ReminderTrayItem) {
    const source = reminders.items.find(
      (row) => row.reminder_id === item.reminder_id,
    );
    setOpen(false);
    if (!source) return;
    const href = hrefForReminder(source);
    if (href) {
      navigate(href);
    }
  }

  async function handleComplete(id: string) {
    setActionError(null);
    try {
      await completeReminder(id);
      reminders.refresh();
    } catch (error) {
      setActionError(reminderErrorMessage(error));
    }
  }

  async function handleCancel(id: string) {
    setActionError(null);
    try {
      await cancelReminder(id);
      reminders.refresh();
    } catch (error) {
      setActionError(reminderErrorMessage(error));
    }
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = TABS.indexOf(tab);
    let next: PanelTab | null = null;
    if (event.key === 'ArrowRight') {
      next = TABS[(index + 1) % TABS.length];
    } else if (event.key === 'ArrowLeft') {
      next = TABS[(index - 1 + TABS.length) % TABS.length];
    } else if (event.key === 'Home') {
      next = 'notificaciones';
    } else if (event.key === 'End') {
      next = 'recordatorios';
    }
    if (!next) return;
    event.preventDefault();
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  const tabClass = (active: boolean) =>
    [
      '-mb-px flex-1 border-b-2 px-3 py-2 text-xs transition-colors',
      active
        ? 'border-accent font-bold text-accent'
        : 'border-transparent text-muted hover:text-accent',
    ].join(' ');

  const loaded = reminders.items.length;

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
          dueReminders > 0 ? 'bell-reminder-active' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label={
          unread > 0
            ? `Notificaciones, ${unread} sin leer`
            : 'Notificaciones'
        }
        aria-expanded={open}
      >
        <Bell size={18} strokeWidth={1.75} className="bell-reminder-icon" />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 min-w-4 rounded-full bg-turquoise px-1 text-center text-[10px] font-bold leading-4 text-ink">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 max-h-[calc(100vh-5rem)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded border border-border bg-surface shadow-card">
          <div
            className="flex border-b border-border"
            role="tablist"
            aria-label="Bandeja"
            onKeyDown={onTabKeyDown}
          >
            <button
              type="button"
              ref={(node) => {
                tabRefs.current.notificaciones = node;
              }}
              id="bell-tab-notificaciones"
              role="tab"
              aria-selected={tab === 'notificaciones'}
              aria-controls="bell-panel-notificaciones"
              tabIndex={tab === 'notificaciones' ? 0 : -1}
              className={tabClass(tab === 'notificaciones')}
              onClick={() => setTab('notificaciones')}
            >
              Notificaciones
              {unread > 0 ? ` (${unread})` : ''}
            </button>
            <button
              type="button"
              ref={(node) => {
                tabRefs.current.recordatorios = node;
              }}
              id="bell-tab-recordatorios"
              role="tab"
              aria-selected={tab === 'recordatorios'}
              aria-controls="bell-panel-recordatorios"
              tabIndex={tab === 'recordatorios' ? 0 : -1}
              className={tabClass(tab === 'recordatorios')}
              onClick={() => setTab('recordatorios')}
            >
              Recordatorios
              {dueReminders > 0 ? ` (${dueReminders})` : ''}
            </button>
          </div>

          {tab === 'notificaciones' ? (
            <div
              id="bell-panel-notificaciones"
              role="tabpanel"
              aria-labelledby="bell-tab-notificaciones"
            >
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
          ) : (
            <div
              id="bell-panel-recordatorios"
              role="tabpanel"
              aria-labelledby="bell-tab-recordatorios"
              className="flex max-h-[calc(100vh-8rem)] flex-col"
            >
              <ReminderGroupTabs
                counts={reminders.counts}
                active={reminders.active}
                onToggle={reminders.toggleGroup}
              />
              {actionError || reminders.error ? (
                <p className="px-3 py-2 text-sm text-danger" role="alert">
                  {actionError || reminders.error}
                </p>
              ) : null}
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <ReminderTrayList
                  items={reminders.items.map(toTrayItem)}
                  loading={reminders.loading}
                  emptyLabel="No hay recordatorios."
                  onComplete={(id) => void handleComplete(id)}
                  onCancel={(id) => void handleCancel(id)}
                  onNavigate={handleOpenReminder}
                  canAct={() => true}
                />
                {!reminders.loading && loaded < reminders.total ? (
                  <button
                    type="button"
                    className="mt-3 w-full text-sm font-bold text-accent hover:underline"
                    onClick={() => void reminders.loadMore()}
                  >
                    Ver más
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
