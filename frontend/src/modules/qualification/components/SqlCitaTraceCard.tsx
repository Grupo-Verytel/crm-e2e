import { useEffect, useState } from 'react';
import { formatDateTime } from '../../../lib/format';
import { fetchSqlAppointmentEvents } from '../api/sqls-api';
import {
  SQL_APPOINTMENT_EVENT_LABELS,
  type SqlAppointmentEvent,
} from '../types/sql-appointment-event.types';
import { cardClass } from './ui';

type Props = {
  sqlId: string;
  refreshKey?: number;
};

function formatClock(value?: string): string {
  return value ? value.slice(0, 5) : '';
}

function eventDetail(event: SqlAppointmentEvent): string {
  const fecha = event.payload?.fecha;
  const hora = formatClock(event.payload?.hora);
  const slot = [fecha, hora].filter(Boolean).join(' · ');
  if (event.event_type === 'Reagendada') {
    const previous = [
      event.payload?.fecha_anterior,
      formatClock(event.payload?.hora_anterior),
    ]
      .filter(Boolean)
      .join(' · ');
    if (previous && slot) {
      return `${previous} → ${slot}`;
    }
  }
  return slot;
}

export function SqlCitaTraceCard({ sqlId, refreshKey = 0 }: Props) {
  const [events, setEvents] = useState<SqlAppointmentEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void fetchSqlAppointmentEvents(sqlId)
      .then((items) => {
        if (!cancelled) setEvents(items);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar la trazabilidad de la cita.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sqlId, refreshKey]);

  return (
    <section className={`${cardClass} p-5`}>
      <h2 className="text-sm font-bold text-ink">Trazabilidad de la cita</h2>
      {isLoading ? (
        <p className="mt-3 text-sm text-muted">Cargando…</p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {!isLoading && !error && events.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Aún no hay eventos de agendamiento en este SQL.
        </p>
      ) : null}
      {events.length > 0 ? (
        <ol className="mt-4 space-y-3">
          {events.map((event) => (
            <li
              key={event.sql_appointment_event_id}
              className="border-l-2 border-accent pl-3"
            >
              <p className="text-sm font-bold text-ink">
                {SQL_APPOINTMENT_EVENT_LABELS[event.event_type]}
              </p>
              <p className="text-xs text-muted">
                {formatDateTime(event.occurred_at)}
                {event.actor_name ? ` · ${event.actor_name}` : ''}
              </p>
              {eventDetail(event) ? (
                <p className="mt-0.5 text-xs text-ink">{eventDetail(event)}</p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
