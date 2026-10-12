import { useEffect, useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import {
  getReminderDisplayStatuses,
  getReminderResolution,
  resolveOuvReminder,
  type ReminderDisplayStatus,
} from './store';
import type { OuvReminder } from './types';

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO');
}

const STATUS_LABEL: Record<ReminderDisplayStatus, string> = {
  realizado: 'Realizado',
  vencido: 'Vencido',
  descartado: 'Sin realizar',
  programado: 'Programado',
};

const STATUS_CLASS: Record<ReminderDisplayStatus, string> = {
  realizado: 'bg-positive/15 text-positive',
  vencido: 'bg-accent/15 text-accent',
  descartado: 'bg-danger/10 text-danger',
  programado: 'bg-bg text-muted',
};

type Props = {
  items: OuvReminder[];
  emptyLabel: string;
};

export function ReminderTrayList({ items, emptyLabel }: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  if (items.length === 0) {
    return (
      <p className="rounded border border-dashed border-border bg-bg px-3 py-6 text-center text-sm text-muted">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const resolution = getReminderResolution(item);
        const statuses = getReminderDisplayStatuses(item, nowMs);
        const done = resolution === 'done';
        return (
          <li
            key={item.reminder_id}
            className="rounded border border-border bg-bg p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">
                  {item.interaccion_titulo}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Programado: {formatWhen(item.remind_at)}
                </p>
                {resolution ? (
                  <p className="mt-0.5 text-xs text-muted">
                    {resolution === 'done' ? 'Marcado' : 'Descartado'}:{' '}
                    {formatWhen(item.resolved_at ?? item.dismissed_at)}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                {statuses.map((status) => (
                  <span
                    key={status}
                    className={[
                      'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold',
                      STATUS_CLASS[status],
                    ].join(' ')}
                  >
                    {status === 'realizado' ? (
                      <Check size={12} strokeWidth={2.25} aria-hidden />
                    ) : status === 'descartado' ? (
                      <X size={12} strokeWidth={2.25} aria-hidden />
                    ) : (
                      <Bell size={12} strokeWidth={2.25} aria-hidden />
                    )}
                    {STATUS_LABEL[status]}
                  </span>
                ))}
              </div>
            </div>
            {done ? null : (
              <button
                type="button"
                className="mt-2 text-xs font-bold text-accent underline underline-offset-2"
                onClick={() => resolveOuvReminder(item.reminder_id, 'done')}
              >
                Marcar como realizado
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
