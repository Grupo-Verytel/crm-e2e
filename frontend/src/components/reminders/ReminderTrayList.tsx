import { Check, X } from 'lucide-react';
import type { ReminderTrayItem } from './types';

const STATUS_LABEL: Record<string, string> = {
  Pendiente: 'Pendiente',
  Enviado: 'Enviado',
  Cancelado: 'Cancelado',
  Realizado: 'Realizado',
};

const STATUS_CLASS: Record<string, string> = {
  Pendiente: 'border-border text-muted',
  Enviado: 'border-accent text-accent',
  Cancelado: 'border-danger text-danger',
  Realizado: 'border-semaphore-verde text-ink',
};

const bogotaDateTime = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function formatBogota(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const parts = bogotaDateTime.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${read('day')}/${read('month')}/${read('year')} ${read('hour')}:${read('minute')}`;
}

function displayStatus(item: ReminderTrayItem): string {
  if (item.completed_at) {
    return 'Realizado';
  }
  return STATUS_LABEL[item.status] ?? item.status;
}

function canComplete(item: ReminderTrayItem): boolean {
  return !item.completed_at && item.status !== 'Cancelado';
}

function canCancel(item: ReminderTrayItem): boolean {
  return item.status === 'Pendiente' && !item.completed_at;
}

type Props = {
  items: ReminderTrayItem[];
  loading: boolean;
  emptyLabel: string;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  onNavigate?: (item: ReminderTrayItem) => void;
  canAct: (item: ReminderTrayItem) => boolean;
};

export function ReminderTrayList({
  items,
  loading,
  emptyLabel,
  onComplete,
  onCancel,
  onNavigate,
  canAct,
}: Props) {
  if (loading) {
    return <p className="text-sm text-muted">Cargando…</p>;
  }
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
        const status = displayStatus(item);
        const tone = STATUS_CLASS[status] ?? STATUS_CLASS.Pendiente;
        const allow = canAct(item);
        return (
          <li
            key={item.reminder_id}
            className="rounded border border-border bg-bg p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {onNavigate ? (
                  <button
                    type="button"
                    className="text-left text-sm font-bold text-accent hover:underline"
                    onClick={() => onNavigate(item)}
                  >
                    {item.source_label}
                  </button>
                ) : (
                  <p className="text-sm font-bold text-ink">{item.source_label}</p>
                )}
                <p className="mt-0.5 text-xs text-muted">
                  {formatBogota(item.event_at)}
                </p>
                {item.note ? (
                  <p className="mt-1 text-sm text-ink">{item.note}</p>
                ) : null}
              </div>
              <span
                className={`inline-flex shrink-0 items-center rounded-sm border px-2 py-0.5 text-xs font-bold ${tone}`}
              >
                {status}
              </span>
            </div>
            {allow ? (
              <div className="mt-2 flex items-center gap-2">
                {canComplete(item) ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-bold text-accent underline underline-offset-2"
                    aria-label="Marcar como realizado"
                    onClick={() => onComplete(item.reminder_id)}
                  >
                    <Check size={14} strokeWidth={2.25} aria-hidden />
                    Marcar como realizado
                  </button>
                ) : null}
                {canCancel(item) ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-bold text-danger"
                    aria-label="Cancelar"
                    onClick={() => {
                      const confirmed = window.confirm(
                        '¿Cancelar este recordatorio? Esta acción no se puede deshacer.',
                      );
                      if (confirmed) {
                        onCancel(item.reminder_id);
                      }
                    }}
                  >
                    <X size={14} strokeWidth={2.25} aria-hidden />
                    Cancelar
                  </button>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
