import { useEffect, useState, type FormEvent } from 'react';
import { formatDateTime } from '../../../lib/format';
import {
  assignSql,
  fetchCommercials,
  type CommercialOption,
  type SqlDetail,
} from '../api/sqls-api';
import {
  needsAgencyCitaGeneration,
  splitCitaDateTime,
  sqlLeadName,
} from '../lib/agency-cita';
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

function leadText(lead: SqlDetail['lead'], key: string): string {
  const value = lead[key];
  return typeof value === 'string' ? value : '';
}

export function AssignSqlModal({ sql, onClose, onAssigned }: Props) {
  const pendingAgencyCita = needsAgencyCitaGeneration(sql);
  const suggested = splitCitaDateTime(
    typeof sql.lead.fecha_cita === 'string' ? sql.lead.fecha_cita : null,
  );
  const [commercials, setCommercials] = useState<CommercialOption[]>([]);
  const [comercialId, setComercialId] = useState('');
  const [withCita, setWithCita] = useState(pendingAgencyCita);
  const [lugar, setLugar] = useState(leadText(sql.lead, 'cita_lugar'));
  const [fecha, setFecha] = useState(suggested?.fecha ?? '');
  const [hora, setHora] = useState(suggested?.hora ?? '09:00');
  const [contactoNombre, setContactoNombre] = useState(
    leadText(sql.lead, 'cita_contacto_nombre') ||
      leadText(sql.lead, 'contacto_nombre'),
  );
  const [contactoEmail, setContactoEmail] = useState(
    leadText(sql.lead, 'cita_contacto_email') || leadText(sql.lead, 'email'),
  );
  const [contactoTelefono, setContactoTelefono] = useState(
    leadText(sql.lead, 'cita_contacto_telefono') ||
      leadText(sql.lead, 'telefono'),
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
    if (pendingAgencyCita && !withCita) {
      setError('Este SQL de agencia requiere generar la cita al asignar.');
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
                ...(contactoEmail.trim()
                  ? { contacto_email: contactoEmail.trim() }
                  : {}),
                ...(contactoTelefono.trim()
                  ? { contacto_telefono: contactoTelefono.trim() }
                  : {}),
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
          {sqlLeadName(sql.lead)}
          {sql.lead.empresa_nombre
            ? ` · ${String(sql.lead.empresa_nombre)}`
            : ''}
        </p>
        {pendingAgencyCita ? (
          <p className="mt-2 rounded bg-accent/10 px-3 py-2 text-sm text-ink">
            Canal agencia: al asignar debes generar la cita indicada al aprobar
            el MQL
            {sql.lead.fecha_cita
              ? ` (${formatDateTime(String(sql.lead.fecha_cita))})`
              : ''}
            .
          </p>
        ) : null}

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
            required={pendingAgencyCita}
          />
          {pendingAgencyCita
            ? 'Generar cita ahora'
            : 'Agendar cita ahora (opcional)'}
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
            <label className={labelClass}>
              Correo
              <input
                type="email"
                className={inputClass}
                value={contactoEmail}
                onChange={(e) => setContactoEmail(e.target.value)}
              />
            </label>
            <label className={labelClass}>
              Teléfono
              <input
                type="tel"
                className={inputClass}
                value={contactoTelefono}
                onChange={(e) => setContactoTelefono(e.target.value)}
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
