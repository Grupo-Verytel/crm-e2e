import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { formatDateTime } from '../../../lib/format';
import {
  fetchGraphAvailability,
  fetchGraphStatus,
  type GraphSchedule,
  type GraphStatus,
} from '../api/graph-api';
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
  citaContactosFromLead,
  type CitaContactoInput,
} from '../lib/cita-contactos';
import {
  buildAvailabilityBlocks,
  combineFechaHora,
  slotConflicts,
  toGraphLocalDateTime,
  weekWindow,
} from '../lib/cita-scheduling';
import { CitaAvailabilityGrid } from './CitaAvailabilityGrid';
import { CitaContactosFields } from './CitaContactosFields';
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

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function AssignSqlModal({ sql, onClose, onAssigned }: Props) {
  const pendingAgencyCita = needsAgencyCitaGeneration(sql);
  const suggested = splitCitaDateTime(
    typeof sql.lead.fecha_cita === 'string' ? sql.lead.fecha_cita : null,
  );
  const [commercials, setCommercials] = useState<CommercialOption[]>([]);
  const [comercialId, setComercialId] = useState('');
  const [withCita, setWithCita] = useState(pendingAgencyCita);
  const [lugar, setLugar] = useState(
    leadText(sql.lead, 'cita_lugar') || 'Microsoft Teams',
  );
  const [fecha, setFecha] = useState(suggested?.fecha ?? '');
  const [hora, setHora] = useState(suggested?.hora ?? '09:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [contactos, setContactos] = useState<CitaContactoInput[]>(() =>
    citaContactosFromLead(sql.lead),
  );
  const [contactoCargo, setContactoCargo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [graphStatus, setGraphStatus] = useState<GraphStatus | null>(null);
  const [schedules, setSchedules] = useState<GraphSchedule[]>([]);
  const [availabilityError, setAvailabilityError] = useState<string | null>(
    null,
  );
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const selectedCommercial = commercials.find((c) => c.user_id === comercialId);
  const commercialEmail = selectedCommercial?.email?.trim() ?? '';
  const orgDomains = graphStatus?.domains ?? [];
  const commercialInTenant =
    Boolean(commercialEmail) &&
    orgDomains.some((domain) =>
      commercialEmail.toLowerCase().endsWith(`@${domain.toLowerCase()}`),
    );

  const [now] = useState(() => new Date());
  const proposed = combineFechaHora(fecha, hora, durationMinutes);
  const weekAnchor = proposed?.start ?? (fecha ? new Date(`${fecha}T00:00:00`) : now);
  const weekKey = `${weekAnchor.getFullYear()}-${weekAnchor.getMonth()}-${weekAnchor.getDate()}`;

  useEffect(() => {
    void fetchCommercials()
      .then(setCommercials)
      .catch(() => setError('No se pudo cargar la lista de comerciales.'));
    void fetchGraphStatus()
      .then(setGraphStatus)
      .catch(() => setGraphStatus(null));
  }, []);

  const loadAvailability = useCallback(
    async (anchor: Date, email: string, organizerUpn: string) => {
      const { start, end } = weekWindow(anchor);
      setLoadingAvailability(true);
      setAvailabilityError(null);
      try {
        const data = await fetchGraphAvailability({
          schedules: [email],
          startTime: toGraphLocalDateTime(start),
          endTime: toGraphLocalDateTime(end),
          timeZone: graphStatus?.timeZone,
          organizerUpn,
        });
        setSchedules(data.schedules);
      } catch (err) {
        setSchedules([]);
        setAvailabilityError(
          err instanceof Error
            ? err.message
            : 'No se pudo consultar la disponibilidad del comercial.',
        );
      } finally {
        setLoadingAvailability(false);
      }
    },
    [graphStatus?.timeZone],
  );

  useEffect(() => {
    if (!withCita || !commercialInTenant) {
      setSchedules([]);
      setAvailabilityError(null);
      return;
    }
    void loadAvailability(weekAnchor, commercialEmail, commercialEmail);
  }, [
    withCita,
    commercialInTenant,
    commercialEmail,
    weekKey,
    loadAvailability,
  ]);

  const blocks = useMemo(() => {
    if (!selectedCommercial || !commercialEmail) {
      return [];
    }
    return buildAvailabilityBlocks({
      weekAnchor,
      resource: {
        id: selectedCommercial.user_id,
        email: commercialEmail,
        label: selectedCommercial.full_name.split(' ')[0] ?? 'Comercial',
      },
      schedules,
      proposedStart: proposed?.start ?? null,
      proposedEnd: proposed?.end ?? null,
    });
  }, [selectedCommercial, commercialEmail, weekAnchor, schedules, proposed]);

  const conflicts =
    proposed && commercialEmail
      ? slotConflicts({
          start: proposed.start,
          end: proposed.end,
          email: commercialEmail,
          schedules,
        })
      : [];

  function handleSelectSlot(start: Date, end: Date) {
    setFecha(
      `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    );
    setHora(`${pad(start.getHours())}:${pad(start.getMinutes())}`);
    const minutes = Math.max(
      15,
      Math.round((end.getTime() - start.getTime()) / 60_000),
    );
    setDurationMinutes(minutes >= 90 ? 90 : minutes >= 60 ? 60 : 30);
  }

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
    const trimmed = contactos.map((contacto) => ({
      nombre: contacto.nombre.trim(),
      email: contacto.email.trim(),
      telefono: contacto.telefono.trim(),
    }));
    const principal = trimmed[0];
    if (withCita && !principal) {
      setError('Agrega al menos un contacto para la cita.');
      return;
    }
    if (withCita && !commercialInTenant) {
      setError(
        'El comercial debe tener un correo de frisson.net.co o grupoverytel.com para crear la reunión de Teams.',
      );
      return;
    }
    if (withCita && conflicts.length > 0) {
      setError(
        `El comercial no está libre en ese horario: ${conflicts[0]}. Elige otro hueco.`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await assignSql(sql.sql_id, {
        comercial_asignado_id: comercialId,
        ...(withCita && principal
          ? {
              cita: {
                lugar: lugar.trim() || 'Microsoft Teams',
                fecha,
                hora,
                duration_minutes: durationMinutes,
                contacto_nombre: principal.nombre,
                contacto_email: principal.email,
                contacto_telefono: principal.telefono,
                contactos: trimmed,
                ...(contactoCargo ? { contacto_cargo: contactoCargo } : {}),
                ...(descripcion ? { descripcion } : {}),
              },
            }
          : {}),
      });
      onAssigned();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo asignar el SQL. Revisa los datos e inténtalo de nuevo.',
      );
    } finally {
      setBusy(false);
    }
  }

  const graphWarning = !graphStatus
    ? null
    : !graphStatus.configured
      ? `Integración con Microsoft 365 sin configurar (faltan: ${graphStatus.missingEnv.join(', ')}).`
      : !graphStatus.canCreateMeetings
        ? 'La aplicación de Entra ID no tiene Calendars.ReadWrite: no se podrá crear la reunión de Teams.'
        : null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className={`max-h-[90vh] w-full overflow-y-auto rounded bg-surface p-5 shadow-card ${
          withCita ? 'max-w-4xl' : 'max-w-lg'
        }`}
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
            Canal agencia: al asignar debes generar la cita en Teams con el
            comercial
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
                {c.email ? ` · ${c.email}` : ''}
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
            ? 'Generar cita de Teams ahora'
            : 'Agendar reunión de Teams ahora (opcional)'}
        </label>

        {withCita ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {graphWarning ? (
              <p className="sm:col-span-2 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                {graphWarning}
              </p>
            ) : (
              <p className="sm:col-span-2 text-sm text-muted">
                La reunión se crea en el calendario de{' '}
                {selectedCommercial?.full_name ?? 'el comercial'} y se invita
                a los contactos de la cita.
              </p>
            )}
            {comercialId && !commercialInTenant ? (
              <p className="sm:col-span-2 rounded border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-ink">
                El comercial no tiene un correo de la organización. No se puede
                consultar su calendario ni crear la reunión de Teams.
              </p>
            ) : null}
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
              Duración
              <select
                className={inputClass}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
              >
                <option value={30}>30 minutos</option>
                <option value={60}>60 minutos</option>
                <option value={90}>90 minutos</option>
              </select>
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
            {commercialInTenant ? (
              <div className="sm:col-span-2">
                <CitaAvailabilityGrid
                  weekAnchor={weekAnchor}
                  blocks={blocks}
                  proposedStart={proposed?.start ?? null}
                  proposedEnd={proposed?.end ?? null}
                  loading={loadingAvailability}
                  error={availabilityError}
                  onSelectSlot={handleSelectSlot}
                />
              </div>
            ) : null}
            {conflicts.length > 0 ? (
              <p className="sm:col-span-2 text-sm text-danger">
                El comercial está ocupado: {conflicts.join(' · ')}
              </p>
            ) : null}
            <CitaContactosFields contacts={contactos} onChange={setContactos} />
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

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={ghostButtonClass} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={primaryButtonClass} disabled={busy}>
            {busy
              ? 'Creando reunión…'
              : withCita
                ? 'Asignar y crear reunión'
                : 'Confirmar asignación'}
          </button>
        </div>
      </form>
    </div>
  );
}
