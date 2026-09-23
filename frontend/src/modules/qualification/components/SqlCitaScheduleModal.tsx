import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiError } from '../../auth/types';
import {
  fetchGraphAvailability,
  fetchGraphStatus,
  type GraphSchedule,
  type GraphStatus,
} from '../api/graph-api';
import {
  createAssignedSqlCita,
  fetchCommercials,
  updateSqlCita,
  type CommercialOption,
  type SqlDetail,
} from '../api/sqls-api';
import { sqlLeadName } from '../lib/agency-cita';
import {
  citaContactosFromLead,
  emptyCitaContacto,
  type CitaContactoInput,
} from '../lib/cita-contactos';
import {
  CITA_TIMEZONE,
  buildAvailabilityBlocks,
  combineFechaHora,
  formatBogota,
  slotConflicts,
  toGraphLocalDateTime,
  weekWindow,
  zonedBogotaDate,
} from '../lib/cita-scheduling';
import { CitaAvailabilityGrid } from './CitaAvailabilityGrid';
import { CitaContactosFields } from './CitaContactosFields';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

type Mode = 'create' | 'update';

type Props = {
  sql: SqlDetail;
  mode: Mode;
  onClose: () => void;
  onSaved: () => void;
  onVigenteConflict: () => void;
};

function initialContactos(sql: SqlDetail): CitaContactoInput[] {
  const fromCita = sql.cita?.contactos;
  if (fromCita && fromCita.length > 0) {
    return fromCita.map((contacto) => ({
      nombre: contacto.nombre,
      email: contacto.email,
      telefono: contacto.telefono,
    }));
  }
  const fromLead = citaContactosFromLead(sql.lead);
  return fromLead.length > 0 ? fromLead : [emptyCitaContacto()];
}

export function SqlCitaScheduleModal({
  sql,
  mode,
  onClose,
  onSaved,
  onVigenteConflict,
}: Props) {
  const comercialId = sql.comercial_asignado_id ?? '';
  const [commercials, setCommercials] = useState<CommercialOption[]>([]);
  const [lugar, setLugar] = useState(sql.cita?.lugar || 'Microsoft Teams');
  const [fecha, setFecha] = useState(mode === 'update' ? (sql.cita?.fecha ?? '') : '');
  const [hora, setHora] = useState(
    mode === 'update' ? (sql.cita?.hora.slice(0, 5) ?? '09:00') : '09:00',
  );
  const [durationMinutes, setDurationMinutes] = useState(
    sql.cita?.duration_minutes ?? 60,
  );
  const [contactos, setContactos] = useState<CitaContactoInput[]>(() =>
    initialContactos(sql),
  );
  const [contactoCargo, setContactoCargo] = useState(sql.cita?.contacto_cargo ?? '');
  const [descripcion, setDescripcion] = useState(sql.cita?.descripcion ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [graphStatus, setGraphStatus] = useState<GraphStatus | null>(null);
  const [schedules, setSchedules] = useState<GraphSchedule[]>([]);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const selectedCommercial = commercials.find((item) => item.user_id === comercialId);
  const commercialEmail = selectedCommercial?.email?.trim() ?? '';
  const orgDomains = graphStatus?.domains ?? [];
  const commercialInTenant =
    Boolean(commercialEmail) &&
    orgDomains.some((domain) =>
      commercialEmail.toLowerCase().endsWith(`@${domain.toLowerCase()}`),
    );

  const [now] = useState(() => new Date());
  const proposed = combineFechaHora(fecha, hora, durationMinutes);
  const weekAnchor =
    proposed?.start ?? (fecha ? zonedBogotaDate(fecha, '00:00') : now);
  const weekKey = formatBogota(weekAnchor).fecha;

  useEffect(() => {
    void fetchCommercials()
      .then(setCommercials)
      .catch(() => setError('No se pudo cargar el comercial asignado.'));
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
          timeZone: graphStatus?.timeZone ?? CITA_TIMEZONE,
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
    if (!commercialInTenant) {
      setSchedules([]);
      setAvailabilityError(null);
      return;
    }
    void loadAvailability(weekAnchor, commercialEmail, commercialEmail);
  }, [commercialInTenant, commercialEmail, weekKey, loadAvailability]);

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
    const startParts = formatBogota(start);
    setFecha(startParts.fecha);
    setHora(startParts.hora);
    const minutes = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60_000));
    setDurationMinutes(minutes >= 90 ? 90 : minutes >= 60 ? 60 : 30);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) {
      return;
    }
    const trimmed = contactos.map((contacto) => ({
      nombre: contacto.nombre.trim(),
      email: contacto.email.trim(),
      telefono: contacto.telefono.trim(),
    }));
    const principal = trimmed[0];
    if (!principal?.nombre) {
      setError('Agrega el contacto principal de la cita.');
      return;
    }
    if (mode === 'create' && (!principal.email || !principal.telefono)) {
      setError('El contacto principal necesita nombre, email y teléfono.');
      return;
    }
    if (!fecha || !hora) {
      setError('Elige fecha y hora.');
      return;
    }
    if (!commercialInTenant) {
      setError(
        'El comercial debe tener un correo de frisson.net.co o grupoverytel.com para la reunión de Teams.',
      );
      return;
    }
    if (conflicts.length > 0) {
      setError(`El comercial no está libre en ese horario: ${conflicts[0]}. Elige otro hueco.`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (mode === 'create') {
        await createAssignedSqlCita(sql.sql_id, {
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
        });
      } else {
        await updateSqlCita(sql.sql_id, {
          lugar: lugar.trim() || 'Microsoft Teams',
          fecha,
          hora,
          duration_minutes: durationMinutes,
          contacto_nombre: principal.nombre,
          ...(contactoCargo ? { contacto_cargo: contactoCargo } : {}),
          ...(descripcion ? { descripcion } : {}),
        });
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CITA_VIGENTE_EXISTS') {
        setError(err.message);
        onVigenteConflict();
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar la cita. Revisa los datos e inténtalo de nuevo.',
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
        onSubmit={(event) => void handleSubmit(event)}
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded bg-surface p-5 shadow-card"
      >
        <h2 className="text-base font-bold text-ink">
          {mode === 'create' ? 'Agendar cita' : 'Reagendar cita'}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {sqlLeadName(sql.lead)}
          {sql.lead.empresa_nombre ? ` · ${String(sql.lead.empresa_nombre)}` : ''}
        </p>
        <p className="mt-2 text-sm text-ink">
          Comercial asignado: {selectedCommercial?.full_name ?? 'el ejecutivo del SQL'}
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {graphWarning ? (
            <p className="sm:col-span-2 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {graphWarning}
            </p>
          ) : (
            <p className="sm:col-span-2 text-sm text-muted">
              La reunión queda en el calendario de{' '}
              {selectedCommercial?.full_name ?? 'el comercial asignado'}.
            </p>
          )}
          {comercialId && commercials.length > 0 && !commercialInTenant ? (
            <p className="sm:col-span-2 rounded border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-ink">
              El comercial no tiene un correo de la organización. No se puede consultar su calendario ni crear la reunión de Teams.
            </p>
          ) : null}
          <label className={labelClass}>
            Lugar
            <input
              className={inputClass}
              value={lugar}
              onChange={(event) => setLugar(event.target.value)}
              required
            />
          </label>
          <label className={labelClass}>
            Duración
            <select
              className={inputClass}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
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
              onChange={(event) => setFecha(event.target.value)}
              required
            />
          </label>
          <label className={labelClass}>
            Hora
            <input
              type="time"
              className={inputClass}
              value={hora}
              onChange={(event) => setHora(event.target.value)}
              required
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
          <CitaContactosFields
            contacts={contactos}
            onChange={setContactos}
            lockEmailPhone={mode === 'update'}
          />
          <label className={`${labelClass} sm:col-span-2`}>
            Cargo (opcional)
            <input
              className={inputClass}
              value={contactoCargo}
              onChange={(event) => setContactoCargo(event.target.value)}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Descripción (opcional)
            <textarea
              className="min-h-20 w-full rounded border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              value={descripcion}
              onChange={(event) => setDescripcion(event.target.value)}
            />
          </label>
        </div>

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={ghostButtonClass} onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className={primaryButtonClass} disabled={busy}>
            {busy ? 'Guardando…' : mode === 'create' ? 'Agendar cita' : 'Reagendar'}
          </button>
        </div>
      </form>
    </div>
  );
}
