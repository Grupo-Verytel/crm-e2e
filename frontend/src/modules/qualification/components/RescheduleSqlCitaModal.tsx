import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { DatePickerField } from '../../../components/DatePickerField';
import { TimePickerField } from '../../../components/TimePickerField';
import { ApiError } from '../../auth/types';
import {
  fetchCommercials,
  updateSqlCita,
  type SqlDetail,
} from '../api/sqls-api';
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

function empresaLabel(sql: SqlDetail): string {
  const empresa = sql.lead.empresa_nombre;
  return typeof empresa === 'string' && empresa.trim() ? empresa : sql.sql_id;
}

export function RescheduleSqlCitaModal({
  sql,
  onClose,
  onRescheduled,
}: Props) {
  const [fecha, setFecha] = useState(sql.cita?.fecha.slice(0, 10) ?? '');
  const [hora, setHora] = useState(sql.cita?.hora.slice(0, 5) ?? '09:00');
  const [commercialName, setCommercialName] = useState('Cargando…');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const comercialId = sql.comercial_asignado_id;
    if (!comercialId) {
      setCommercialName('Sin ejecutivo asignado');
      return;
    }
    void fetchCommercials()
      .then((items) => {
        const match = items.find((item) => item.user_id === comercialId);
        setCommercialName(match?.full_name ?? 'Ejecutivo asignado');
      })
      .catch(() => setCommercialName('Ejecutivo asignado'));
  }, [sql.comercial_asignado_id]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) {
      return;
    }
    if (!fecha || !hora) {
      setError('Completa fecha y hora.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updateSqlCita(sql.sql_id, { fecha, hora });
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
      <div className="w-full max-w-md rounded bg-surface shadow-card">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-ink">Reagendar cita</h2>
            <p className="mt-1 text-sm text-muted">{empresaLabel(sql)}</p>
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

        <form
          className="space-y-4 px-5 py-4"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div>
            <label className={labelClass} htmlFor="reschedule-commercial">
              Ejecutivo Comercial
            </label>
            <input
              id="reschedule-commercial"
              className={inputClass}
              value={commercialName}
              readOnly
              aria-readonly="true"
            />
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
