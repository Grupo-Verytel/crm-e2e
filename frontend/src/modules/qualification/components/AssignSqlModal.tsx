import { useEffect, useState, type FormEvent } from 'react';
import {
  assignSql,
  fetchCommercials,
  type CommercialOption,
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
  onAssigned: () => void;
};

export function AssignSqlModal({ sql, onClose, onAssigned }: Props) {
  const [commercials, setCommercials] = useState<CommercialOption[]>([]);
  const [comercialId, setComercialId] = useState('');
  const [withCita, setWithCita] = useState(false);
  const [lugar, setLugar] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('09:00');
  const [contactoNombre, setContactoNombre] = useState(
    String(sql.lead.contacto_nombre ?? ''),
  );
  const [contactoCargo, setContactoCargo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchCommercials()
      .then(setCommercials)
      .catch(() => setError('No se pudo cargar la lista de comerciales.'));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!comercialId) {
      setError('Selecciona un Ejecutivo Comercial.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await assignSql(sql.sql_id, {
        comercial_asignado_id: comercialId,
        ...(withCita
          ? {
              cita: {
                lugar,
                fecha,
                hora,
                contacto_nombre: contactoNombre,
                ...(contactoCargo ? { contacto_cargo: contactoCargo } : {}),
                ...(descripcion ? { descripcion } : {}),
              },
            }
          : {}),
      });
      onAssigned();
      onClose();
    } catch {
      setError('No se pudo asignar el SQL. Revisa los datos e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-lg rounded bg-surface p-5 shadow-card"
      >
        <h2 className="text-base font-bold text-ink">Asignar SQL</h2>
        <p className="mt-1 text-sm text-muted">
          {String(sql.lead.empresa_nombre ?? sql.sql_id)}
        </p>

        <label className={`${labelClass} mt-4`}>
          Ejecutivo Comercial
          <select
            className={inputClass}
            value={comercialId}
            onChange={(e) => setComercialId(e.target.value)}
            required
          >
            <option value="">Seleccionar…</option>
            {commercials.map((c) => (
              <option key={c.user_id} value={c.user_id}>
                {c.full_name}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={withCita}
            onChange={(e) => setWithCita(e.target.checked)}
          />
          Agendar cita ahora (opcional)
        </label>

        {withCita ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Lugar
              <input
                className={inputClass}
                value={lugar}
                onChange={(e) => setLugar(e.target.value)}
                required={withCita}
              />
            </label>
            <label className={labelClass}>
              Fecha
              <input
                type="date"
                className={inputClass}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required={withCita}
              />
            </label>
            <label className={labelClass}>
              Hora
              <input
                type="time"
                className={inputClass}
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                required={withCita}
              />
            </label>
            <label className={labelClass}>
              Contacto
              <input
                className={inputClass}
                value={contactoNombre}
                onChange={(e) => setContactoNombre(e.target.value)}
                required={withCita}
              />
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Cargo (opcional)
              <input
                className={inputClass}
                value={contactoCargo}
                onChange={(e) => setContactoCargo(e.target.value)}
              />
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Descripción (opcional)
              <textarea
                className="min-h-20 w-full rounded border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </label>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={ghostButtonClass} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={primaryButtonClass} disabled={busy}>
            {busy ? 'Asignando…' : 'Confirmar asignación'}
          </button>
        </div>
      </form>
    </div>
  );
}
