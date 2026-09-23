import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { DatePickerField } from '../../../components/DatePickerField';
import { TimePickerField } from '../../../components/TimePickerField';
import { ApiError } from '../../auth/types';
import {
  fetchCommercials,
  reschedulePlannedCita,
  type CommercialOption,
  type SqlDetail,
} from '../api/sqls-api';
import {
  dateFromIso,
  timeFromIso,
} from '../lib/sql-assignment-scheduling';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

type Props = {
  sql: SqlDetail;
  onClose: () => void;
  onRescheduled: () => void;
};

function leadString(lead: SqlDetail['lead'], key: string): string {
  const value = lead[key];
  return typeof value === 'string' ? value : '';
}

export function ReschedulePlannedCitaModal({
  sql,
  onClose,
  onRescheduled,
}: Props) {
  const plannedDate = sql.cita_planificada?.fecha_cita ?? '';
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('09:00');
  const [commercials, setCommercials] = useState<CommercialOption[]>([]);
  const [comercialId, setComercialId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (plannedDate) {
      setFecha(dateFromIso(plannedDate));
      setHora(timeFromIso(plannedDate));
    }
    const existingCommercial =
      sql.cita_planificada?.comercial_asignado_id ??
      leadString(sql.lead, 'comercial_asignado_id');
    if (existingCommercial) {
      setComercialId(existingCommercial);
    }
  }, [plannedDate, sql]);

  useEffect(() => {
    void fetchCommercials()
      .then((items) => {
        setCommercials(items);
        setComercialId((current) => {
          if (current && items.some((item) => item.user_id === current)) {
            return current;
          }
          return items[0]?.user_id ?? '';
        });
      })
      .catch(() => setError('No se pudo cargar la lista de comerciales.'));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!fecha || !hora) {
      setError('Completa fecha y hora.');
      return;
    }

    const fechaCita = new Date(`${fecha}T${hora}:00`).toISOString();
    setBusy(true);
    setError(null);
    try {
      await reschedulePlannedCita(sql.sql_id, {
        fecha_cita: fechaCita,
        ...(comercialId ? { comercial_asignado_id: comercialId } : {}),
      });
      onRescheduled();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError && err.message
          ? err.message
          : 'No se pudo reagendar la cita.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Reagendar cita"
    >
      <div
        className="w-full max-w-md rounded bg-surface shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-ink">Reagendar cita</h2>
            <p className="mt-1 text-sm text-muted">
              {leadString(sql.lead, 'empresa_nombre') || sql.sql_id}
            </p>
          </div>
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

        <form className="space-y-4 px-5 py-4" onSubmit={(event) => void handleSubmit(event)}>
          <div>
            <label className={labelClass} htmlFor="reschedule-commercial">
              Ejecutivo Comercial
            </label>
            <select
              id="reschedule-commercial"
              className={inputClass}
              value={comercialId}
              onChange={(event) => setComercialId(event.target.value)}
            >
              <option value="">Seleccionar…</option>
              {commercials.map((commercial) => (
                <option key={commercial.user_id} value={commercial.user_id}>
                  {commercial.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="reschedule-fecha">
                Fecha
              </label>
              <DatePickerField
                id="reschedule-fecha"
                value={fecha}
                onChange={setFecha}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="reschedule-hora">
                Hora
              </label>
              <TimePickerField
                id="reschedule-hora"
                value={hora}
                onChange={setHora}
              />
            </div>
          </div>

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
              Cancelar
            </button>
            <button type="submit" className={primaryButtonClass} disabled={busy}>
              {busy ? 'Guardando…' : 'Reagendar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
