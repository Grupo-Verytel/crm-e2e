import { useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { DatePickerField } from '../../../components/DatePickerField';
import { TimePickerField } from '../../../components/TimePickerField';
import { formatDateTime } from '../../../lib/format';
import { fetchLead } from '../../demand-generation/api/leads-api';
import { ApiError } from '../../auth/types';
import {
  fetchGraphAvailability,
  fetchGraphStatus,
  type GraphSchedule,
  type GraphStatus,
} from '../api/graph-api';
import {
  assignSql,
  createAssignedSqlCita,
  fetchCommercials,
  type CommercialOption,
  type SqlCita,
  type SqlDetail,
} from '../api/sqls-api';
import {
  needsAgencyCitaGeneration,
  splitCitaDateTime,
  sqlLeadName,
} from '../lib/agency-cita';
import { MAX_CITA_CONTACTOS, citaContactosFromLead } from '../lib/cita-contactos';
import {
  CITA_TIMEZONE,
  buildAvailabilityBlocks,
  formatBogota,
  slotConflicts,
  toGraphLocalDateTime,
  weekWindow,
  zonedBogotaDate,
} from '../lib/cita-scheduling';
import {
  addMinutesToTime,
  buildMeetingDescription,
  createContactId,
  durationMinutesBetween,
  formatSqlAppointmentRange,
  leadContactsToDrafts,
  resolveSqlLugar,
  type MeetingContactDraft,
  type SqlUbicacionTipo,
} from '../lib/sql-assignment-scheduling';
import { CitaAvailabilityGrid } from './CitaAvailabilityGrid';
import { SqlMeetingContactsEditor } from './SqlMeetingContactsEditor';
import {
  cardClass,
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

type Props = {
  sql: SqlDetail;
  onClose: () => void;
  onAssigned: () => void;
  /** Agenda una cita en un SQL ya asignado. No cambia el comercial. */
  scheduleOnly?: boolean;
  onVigenteConflict?: () => void;
};

type ScheduleTab = 'datos' | 'disponibilidad' | 'contactos' | 'confirmacion';
type Phase = 'form' | 'done';

type AssignResult = {
  withCita: boolean;
  cita: SqlCita | null;
  commercialName: string;
};

const TAB_CLASS =
  'rounded px-3 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40';

function leadText(lead: SqlDetail['lead'], key: string): string {
  const value = lead[key];
  return typeof value === 'string' ? value : '';
}

function draftsFromSql(sql: SqlDetail): MeetingContactDraft[] {
  const fromLead = citaContactosFromLead(sql.lead);
  if (fromLead.length === 0) {
    return [
      {
        id: createContactId(),
        nombre: '',
        email: '',
        telefono: '',
        cargo: '',
      },
    ];
  }
  return fromLead.map((contacto) => ({
    id: createContactId(),
    nombre: contacto.nombre,
    email: contacto.email,
    telefono: contacto.telefono,
    cargo: '',
  }));
}

function resolveAssignError(err: unknown): string {
  if (err instanceof ApiError && err.message.trim()) {
    return err.message;
  }
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  return 'No se pudo asignar el SQL. Revisa los datos e inténtalo de nuevo.';
}

export function AssignSqlModal({
  sql,
  onClose,
  onAssigned,
  scheduleOnly = false,
  onVigenteConflict,
}: Props) {
  const pendingAgencyCita = needsAgencyCitaGeneration(sql);
  const suggested = splitCitaDateTime(
    typeof sql.lead.fecha_cita === 'string' ? sql.lead.fecha_cita : null,
  );
  const initialLugar = leadText(sql.lead, 'cita_lugar') || 'Microsoft Teams';
  const initialBundle = useMemo(() => {
    const contacts = draftsFromSql(sql);
    return { contacts, selectedId: contacts[0]?.id ?? null };
  }, [sql]);

  const [commercials, setCommercials] = useState<CommercialOption[]>([]);
  const [commercialsLoaded, setCommercialsLoaded] = useState(false);
  const [comercialId, setComercialId] = useState(
    scheduleOnly ? (sql.comercial_asignado_id ?? '') : '',
  );
  const [registerCita, setRegisterCita] = useState(true);
  const [tab, setTab] = useState<ScheduleTab>('datos');
  const [ubicacion, setUbicacion] = useState<SqlUbicacionTipo>(
    /presencial/i.test(initialLugar) ? 'Presencial' : 'Teams',
  );
  const [lugarDetalle, setLugarDetalle] = useState(initialLugar);
  const [fecha, setFecha] = useState(suggested?.fecha ?? '');
  const [horaInicio, setHoraInicio] = useState(suggested?.hora ?? '09:00');
  const [horaFin, setHoraFin] = useState(
    suggested ? addMinutesToTime(suggested.hora, 60) : '10:00',
  );
  const [contacts, setContacts] = useState<MeetingContactDraft[]>(
    initialBundle.contacts,
  );
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    initialBundle.selectedId,
  );
  const [availabilityChecked, setAvailabilityChecked] = useState(false);
  const [contactsUnlocked, setContactsUnlocked] = useState(false);
  const [confirmacionUnlocked, setConfirmacionUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [result, setResult] = useState<AssignResult | null>(null);
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

  const duration = durationMinutesBetween(fecha, horaInicio, horaFin);
  const proposedStart = fecha && horaInicio ? zonedBogotaDate(fecha, horaInicio) : null;
  const proposedEnd =
    proposedStart && duration
      ? new Date(proposedStart.getTime() + duration * 60_000)
      : fecha && horaFin
        ? zonedBogotaDate(fecha, horaFin)
        : null;
  const weekAnchor = proposedStart ?? (fecha ? zonedBogotaDate(fecha, '12:00') : new Date());
  const weekKey = formatBogota(weekAnchor).fecha;
  const proposedRange = formatSqlAppointmentRange(fecha, horaInicio, horaFin);
  const appointmentHint = sql.lead.fecha_cita
    ? formatDateTime(String(sql.lead.fecha_cita))
    : null;

  useEffect(() => {
    let active = true;
    void fetchCommercials()
      .then((items) => {
        if (!active) return;
        const list = Array.isArray(items) ? items : [];
        setCommercials(list);
        if (scheduleOnly) return;
        const preferredId = leadText(sql.lead, 'comercial_asignado_id');
        if (preferredId && list.some((item) => item.user_id === preferredId)) {
          setComercialId(preferredId);
        }
      })
      .catch(() => {
        if (active) {
          setError('No se pudo cargar la lista de Ejecutivo Comercial.');
        }
      })
      .finally(() => {
        if (active) setCommercialsLoaded(true);
      });
    void fetchGraphStatus()
      .then((status) => {
        if (active) setGraphStatus(status);
      })
      .catch(() => {
        if (active) setGraphStatus(null);
      });
    return () => {
      active = false;
    };
  }, [scheduleOnly, sql]);

  useEffect(() => {
    const leadId = typeof sql.lead.lead_id === 'string' ? sql.lead.lead_id : null;
    if (!leadId) return;
    let active = true;
    void fetchLead(leadId)
      .then((lead) => {
        if (!active) return;
        const drafts = leadContactsToDrafts(lead.contacts ?? []);
        if (drafts.length === 0) return;
        setContacts(drafts);
        setSelectedContactId(drafts[0]?.id ?? null);
      })
      .catch(() => {
        // Keep the contact copied from the SQL when the lead detail is unavailable.
      });
    return () => {
      active = false;
    };
  }, [sql.lead.lead_id]);

  const loadAvailability = useCallback(
    async (anchor: Date, email: string) => {
      const { start, end } = weekWindow(anchor);
      setLoadingAvailability(true);
      setAvailabilityError(null);
      try {
        const data = await fetchGraphAvailability({
          schedules: [email],
          startTime: toGraphLocalDateTime(start),
          endTime: toGraphLocalDateTime(end),
          timeZone: graphStatus?.timeZone ?? CITA_TIMEZONE,
          organizerUpn: email,
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
    if (!commercialInTenant || !registerCita) {
      setSchedules([]);
      setAvailabilityError(null);
      return;
    }
    void loadAvailability(weekAnchor, commercialEmail);
  }, [commercialInTenant, commercialEmail, weekKey, registerCita, loadAvailability]);

  const blocks = useMemo(() => {
    if (!selectedCommercial || !commercialEmail) return [];
    return buildAvailabilityBlocks({
      weekAnchor,
      resource: {
        id: selectedCommercial.user_id,
        email: commercialEmail,
        label: selectedCommercial.full_name.split(' ')[0] ?? 'Comercial',
      },
      schedules,
      proposedStart,
      proposedEnd,
    });
  }, [
    selectedCommercial,
    commercialEmail,
    weekAnchor,
    schedules,
    proposedStart,
    proposedEnd,
  ]);

  const conflicts =
    proposedStart && proposedEnd && commercialEmail
      ? slotConflicts({
          start: proposedStart,
          end: proposedEnd,
          email: commercialEmail,
          schedules,
        })
      : [];

  const availabilityMessages = !availabilityChecked
    ? []
    : !commercialInTenant
      ? [
          'El comercial no tiene un correo de la organización. No se puede consultar su calendario ni crear la reunión de Teams.',
        ]
      : availabilityError
        ? [availabilityError]
        : loadingAvailability
          ? ['Consultando el calendario del comercial.']
          : conflicts;

  const availabilityOk =
    availabilityChecked &&
    commercialInTenant &&
    !loadingAvailability &&
    !availabilityError &&
    conflicts.length === 0 &&
    duration !== null;

  const graphWarning = !graphStatus
    ? null
    : !graphStatus.configured
      ? `Integración con Microsoft 365 sin configurar (faltan: ${graphStatus.missingEnv.join(', ')}).`
      : !graphStatus.canCreateMeetings
        ? 'La aplicación de Entra ID no tiene Calendars.ReadWrite: no se podrá crear la reunión de Teams.'
        : null;

  function invalidateAvailability() {
    setAvailabilityChecked(false);
    setContactsUnlocked(false);
    setConfirmacionUnlocked(false);
    if (tab !== 'datos') {
      setTab('datos');
    }
  }

  function changeUbicacion(tipo: SqlUbicacionTipo) {
    setUbicacion(tipo);
    setLugarDetalle(tipo === 'Teams' ? 'Microsoft Teams' : '');
    invalidateAvailability();
  }

  function updateContact(id: string, patch: Partial<MeetingContactDraft>) {
    setContacts((prev) =>
      prev.map((contact) => (contact.id === id ? { ...contact, ...patch } : contact)),
    );
  }

  function addContact() {
    if (contacts.length >= MAX_CITA_CONTACTOS) return;
    const id = createContactId();
    setContacts((prev) => [
      ...prev,
      { id, nombre: '', email: '', telefono: '', cargo: '' },
    ]);
    setSelectedContactId(id);
  }

  function removeContact(id: string) {
    setContacts((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((contact) => contact.id !== id);
      if (selectedContactId === id) {
        setSelectedContactId(next[0]?.id ?? null);
      }
      return next;
    });
  }

  function validateDatosStep(): string | null {
    if (!comercialId) {
      return scheduleOnly
        ? 'Este SQL no tiene un Ejecutivo Comercial asignado.'
        : 'Selecciona un Ejecutivo Comercial.';
    }
    if (!fecha || !horaInicio || !horaFin) {
      return 'Completa fecha, hora de inicio y hora fin.';
    }
    if (horaFin <= horaInicio) {
      return 'La hora fin debe ser posterior a la hora de inicio.';
    }
    if (duration === null) {
      return 'La cita debe durar entre 15 y 180 minutos.';
    }
    if (ubicacion === 'Presencial' && !lugarDetalle.trim()) {
      return 'Indica la dirección o sede de la reunión presencial.';
    }
    return null;
  }

  function validateContactsStep(): string | null {
    const filled = contacts.filter((contact) => contact.nombre.trim());
    const primary = filled[0];
    if (!primary?.nombre.trim()) {
      return 'Indica el nombre del contacto principal.';
    }
    if (!primary.email.trim() || !primary.telefono.trim()) {
      return 'El contacto principal necesita correo y teléfono para la reunión de Teams.';
    }
    const incomplete = filled.find(
      (contact) => !contact.email.trim() || !contact.telefono.trim(),
    );
    if (incomplete) {
      return `Completa correo y teléfono de ${incomplete.nombre.trim()}.`;
    }
    return null;
  }

  function runAvailabilityValidation() {
    setError(null);
    const datosError = validateDatosStep();
    if (datosError) {
      setError(datosError);
      return;
    }
    if (commercialInTenant && loadingAvailability) {
      setError('Espera a que termine la consulta del calendario.');
      return;
    }
    setAvailabilityChecked(true);
    setTab('disponibilidad');
  }

  function continueToContacts() {
    setError(null);
    if (!availabilityOk) {
      setError('Confirma un horario disponible antes de continuar.');
      return;
    }
    setContactsUnlocked(true);
    setConfirmacionUnlocked(false);
    setTab('contactos');
  }

  function continueToConfirmacion() {
    setError(null);
    const contactsError = validateContactsStep();
    if (contactsError) {
      setError(contactsError);
      return;
    }
    setConfirmacionUnlocked(true);
    setTab('confirmacion');
  }

  function handleSelectSlot(start: Date, end: Date) {
    const startParts = formatBogota(start);
    const endParts = formatBogota(end);
    setFecha(startParts.fecha);
    setHoraInicio(startParts.hora);
    setHoraFin(endParts.hora);
    setAvailabilityChecked(true);
    setContactsUnlocked(false);
    setConfirmacionUnlocked(false);
  }

  function citaPayload() {
    const filled = contacts
      .filter((contact) => contact.nombre.trim())
      .map((contact) => ({
        nombre: contact.nombre.trim(),
        email: contact.email.trim(),
        telefono: contact.telefono.trim(),
        cargo: contact.cargo.trim(),
      }));
    const primary = filled[0];
    const descripcion = buildMeetingDescription(filled);
    return {
      lugar: resolveSqlLugar(ubicacion, lugarDetalle),
      fecha,
      hora: horaInicio,
      duration_minutes: duration ?? 60,
      contacto_nombre: primary.nombre,
      contacto_email: primary.email,
      contacto_telefono: primary.telefono,
      contactos: filled.map(({ nombre, email, telefono }) => ({
        nombre,
        email,
        telefono,
      })),
      ...(primary.cargo ? { contacto_cargo: primary.cargo } : {}),
      ...(descripcion ? { descripcion } : {}),
    };
  }

  function finish(next: AssignResult) {
    setResult(next);
    setPhase('done');
    onAssigned();
  }

  async function handleAssignWithoutCita() {
    if (pendingAgencyCita) {
      setError('Este SQL requiere generar la cita al asignar.');
      setRegisterCita(true);
      return;
    }
    if (!comercialId) {
      setError('Selecciona un Ejecutivo Comercial.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await assignSql(sql.sql_id, {
        comercial_asignado_id: comercialId,
      });
      finish({
        withCita: false,
        cita: response.cita,
        commercialName: selectedCommercial?.full_name ?? comercialId,
      });
    } catch (err) {
      setError(resolveAssignError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleScheduleOnlyWithCita() {
    if (
      sql.comercial_asignado_id &&
      comercialId !== sql.comercial_asignado_id
    ) {
      setError(
        'La cita se crea para el ejecutivo ya asignado a este SQL. Elige ese nombre en la lista.',
      );
      setTab('datos');
      return;
    }
    const datosError = validateDatosStep();
    if (datosError) {
      setError(datosError);
      setTab('datos');
      return;
    }
    const contactsError = validateContactsStep();
    if (contactsError) {
      setError(contactsError);
      setTab('contactos');
      return;
    }
    if (!availabilityOk) {
      setError('Valida la disponibilidad antes de agendar.');
      setTab('disponibilidad');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const cita = await createAssignedSqlCita(sql.sql_id, citaPayload());
      finish({
        withCita: true,
        cita,
        commercialName: selectedCommercial?.full_name ?? 'el ejecutivo del SQL',
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CITA_VIGENTE_EXISTS') {
        setError(err.message);
        onVigenteConflict?.();
        return;
      }
      setError(resolveAssignError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAssignWithCita() {
    const datosError = validateDatosStep();
    if (datosError) {
      setError(datosError);
      setTab('datos');
      return;
    }
    const contactsError = validateContactsStep();
    if (contactsError) {
      setError(contactsError);
      setTab('contactos');
      return;
    }
    if (!availabilityOk) {
      setError('Valida la disponibilidad antes de asignar.');
      setTab('disponibilidad');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await assignSql(sql.sql_id, {
        comercial_asignado_id: comercialId,
        cita: citaPayload(),
      });
      finish({
        withCita: true,
        cita: response.cita,
        commercialName: selectedCommercial?.full_name ?? comercialId,
      });
    } catch (err) {
      setError(resolveAssignError(err));
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    if (busy) return;
    onClose();
  }

  function tabBtn(id: ScheduleTab, label: string, unlocked: boolean) {
    const active = tab === id;
    return (
      <button
        type="button"
        className={`${TAB_CLASS} ${
          active ? 'bg-accent text-white' : 'bg-bg text-muted hover:text-ink'
        }`}
        disabled={!unlocked && !active}
        onClick={() => unlocked && setTab(id)}
      >
        {label}
      </button>
    );
  }

  const modalWidth = registerCita ? 'max-w-[54rem]' : 'max-w-lg';
  const modalTitle = scheduleOnly ? 'Agendar cita' : 'Asignar SQL';
  const showSimpleAssign = !scheduleOnly && !registerCita;
  const empresa = leadText(sql.lead, 'empresa_nombre') || sqlLeadName(sql.lead);
  const contactoNombre = leadText(sql.lead, 'contacto_nombre');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={modalTitle}
    >
      <div
        className={`flex max-h-[92vh] w-full flex-col overflow-y-auto rounded bg-surface shadow-card ${modalWidth}`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-ink">{modalTitle}</h2>
            <p className="mt-1 text-sm text-muted">
              {empresa}
              {contactoNombre ? ` · ${contactoNombre}` : ''}
            </p>
          </div>
          <button
            type="button"
            className="icon-btn grid h-8 w-8 shrink-0 place-items-center rounded"
            aria-label="Cerrar"
            disabled={busy}
            onClick={handleClose}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        {registerCita && phase === 'form' ? (
          <div className="flex flex-wrap gap-2 border-b border-border px-5 py-3">
            {tabBtn('datos', '1 · Asignación y cita', true)}
            {tabBtn('disponibilidad', '2 · Disponibilidad', availabilityChecked)}
            {tabBtn('contactos', '3 · Contactos', contactsUnlocked)}
            {tabBtn('confirmacion', '4 · Confirmación', confirmacionUnlocked)}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {phase === 'done' && result ? (
            <div className="space-y-4">
              <div className="rounded border border-success/40 bg-success/10 px-4 py-3 text-sm text-ink">
                <p className="font-bold">
                  {scheduleOnly
                    ? 'Cita agendada correctamente'
                    : 'SQL asignado correctamente'}
                </p>
                <p className="mt-1 text-muted">Ejecutivo: {result.commercialName}</p>
              </div>
              {result.withCita && result.cita ? (
                <div className="rounded border border-border bg-bg px-4 py-3 text-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    Cita agendada
                  </p>
                  <p className="mt-2 font-bold text-ink">
                    {result.cita.fecha} {result.cita.hora.slice(0, 5)} · {result.cita.lugar}
                  </p>
                  <p className="mt-1 text-muted">
                    Contacto: {result.cita.contacto_nombre}
                    {result.cita.contacto_cargo ? ` · ${result.cita.contacto_cargo}` : ''}
                  </p>
                  {result.cita.teams_join_url ? (
                    <a
                      href={result.cita.teams_join_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs font-bold text-accent hover:underline"
                    >
                      Unirse a Teams
                    </a>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted">
                  La asignación quedó registrada sin cita agendada.
                </p>
              )}
              <div className="flex justify-end">
                <button type="button" className={primaryButtonClass} onClick={handleClose}>
                  Cerrar
                </button>
              </div>
            </div>
          ) : registerCita ? (
            <>
              {tab === 'datos' ? (
                <div className="space-y-4">
                  {appointmentHint ? (
                    <div className="rounded border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-ink">
                      Hay una posible reunión registrada al aprobar el MQL (
                      {appointmentHint}). Puedes usarla como base para la cita.
                    </div>
                  ) : null}

                  {!scheduleOnly ? (
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={registerCita}
                        disabled={pendingAgencyCita}
                        onChange={(event) => {
                          setRegisterCita(event.target.checked);
                          setError(null);
                          invalidateAvailability();
                        }}
                      />
                      Registrar cita al asignar
                    </label>
                  ) : null}

                  <div>
                    <label className={labelClass} htmlFor="assign-commercial">
                      Ejecutivo Comercial
                    </label>
                    <select
                      id="assign-commercial"
                      className={inputClass}
                      value={comercialId}
                      disabled={scheduleOnly || !commercialsLoaded}
                      aria-disabled={scheduleOnly || !commercialsLoaded}
                      title={
                        scheduleOnly
                          ? 'El ejecutivo ya está asignado a este SQL'
                          : undefined
                      }
                      onChange={(event) => {
                        setComercialId(event.target.value);
                        invalidateAvailability();
                      }}
                    >
                      <option value="">
                        {commercialsLoaded ? 'Seleccionar…' : 'Cargando…'}
                      </option>
                      {commercials.map((commercial) => (
                        <option key={commercial.user_id} value={commercial.user_id}>
                          {commercial.full_name}
                          {commercial.email ? ` · ${commercial.email}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className={labelClass}>Lugar</span>
                    <div className="mb-2 flex flex-wrap gap-4 text-sm text-ink">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="assign-ubicacion"
                          checked={ubicacion === 'Teams'}
                          onChange={() => changeUbicacion('Teams')}
                        />
                        Virtual (Teams)
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="assign-ubicacion"
                          checked={ubicacion === 'Presencial'}
                          onChange={() => changeUbicacion('Presencial')}
                        />
                        Presencial
                      </label>
                    </div>
                    <input
                      className={inputClass}
                      value={lugarDetalle}
                      placeholder={
                        ubicacion === 'Teams'
                          ? 'Microsoft Teams'
                          : 'Dirección o sede de la reunión presencial'
                      }
                      onChange={(event) => {
                        setLugarDetalle(event.target.value);
                        invalidateAvailability();
                      }}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className={labelClass} htmlFor="assign-fecha">
                        Fecha
                      </label>
                      <DatePickerField
                        id="assign-fecha"
                        value={fecha}
                        onChange={(next) => {
                          setFecha(next);
                          invalidateAvailability();
                        }}
                      />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="assign-hora-inicio">
                        Hora inicio
                      </label>
                      <TimePickerField
                        id="assign-hora-inicio"
                        value={horaInicio}
                        onChange={(next) => {
                          setHoraInicio(next);
                          invalidateAvailability();
                        }}
                      />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="assign-hora-fin">
                        Hora fin
                      </label>
                      <TimePickerField
                        id="assign-hora-fin"
                        value={horaFin}
                        onChange={(next) => {
                          setHoraFin(next);
                          invalidateAvailability();
                        }}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted">
                    La reunión se crea en el calendario del comercial y se invita a
                    los contactos.
                  </p>
                  {graphWarning ? (
                    <p className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                      {graphWarning}
                    </p>
                  ) : null}

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
                      onClick={handleClose}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className={primaryButtonClass}
                      onClick={runAvailabilityValidation}
                    >
                      Validar disponibilidad
                    </button>
                  </div>
                </div>
              ) : null}

              {tab === 'disponibilidad' ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-ink">
                        Disponibilidad del comercial
                      </h3>
                      {proposedRange ? (
                        <p className="mt-1 text-xs text-muted">
                          Cita propuesta: {proposedRange}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className={primaryButtonClass}
                      disabled={!availabilityOk}
                      onClick={continueToContacts}
                    >
                      Continuar a contactos
                    </button>
                  </div>

                  {availabilityMessages.length > 0 ? (
                    <div className="rounded border border-border bg-bg p-3 text-sm">
                      {availabilityOk ? null : (
                        <ul className="list-disc pl-4 text-danger">
                          {availabilityMessages.map((message) => (
                            <li key={message}>{message}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                  {availabilityOk ? (
                    <p className="text-sm text-positive">
                      Horario disponible para el Ejecutivo Comercial.
                    </p>
                  ) : null}

                  {selectedCommercial && commercialInTenant ? (
                    <CitaAvailabilityGrid
                      weekAnchor={weekAnchor}
                      blocks={blocks}
                      proposedStart={proposedStart}
                      proposedEnd={proposedEnd}
                      loading={loadingAvailability}
                      error={availabilityError}
                      onSelectSlot={handleSelectSlot}
                    />
                  ) : (
                    <p className="text-sm text-muted">
                      Selecciona un Ejecutivo Comercial con correo de la organización.
                    </p>
                  )}

                  {error ? (
                    <p className="text-sm text-danger" role="alert">
                      {error}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {tab === 'contactos' ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-ink">Contactos</h3>
                    <p className="mt-1 text-xs text-muted">
                      Selecciona una tarjeta para ver y editar el detalle del
                      contacto citado a la reunión.
                    </p>
                  </div>
                  <SqlMeetingContactsEditor
                    contacts={contacts}
                    selectedId={selectedContactId}
                    canAdd={contacts.length < MAX_CITA_CONTACTOS}
                    onSelect={setSelectedContactId}
                    onChange={updateContact}
                    onAdd={addContact}
                    onRemove={removeContact}
                  />
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
                      onClick={() => setTab('disponibilidad')}
                    >
                      Volver
                    </button>
                    <button
                      type="button"
                      className={primaryButtonClass}
                      onClick={continueToConfirmacion}
                    >
                      Continuar a confirmación
                    </button>
                  </div>
                </div>
              ) : null}

              {tab === 'confirmacion' ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-ink">
                      Confirmación de agenda
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      {scheduleOnly
                        ? 'Revisa la cita y los contactos antes de agendar.'
                        : 'Revisa la cita y los contactos antes de asignar el SQL.'}
                    </p>
                  </div>

                  <div className={`${cardClass} space-y-3 p-4`}>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">
                      Asignación
                    </p>
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-muted">Empresa</dt>
                        <dd className="font-bold text-ink">{empresa || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Ejecutivo Comercial</dt>
                        <dd className="font-bold text-ink">
                          {selectedCommercial?.full_name ?? '—'}
                          {selectedCommercial?.email ? (
                            <span className="block text-xs font-normal text-muted">
                              {selectedCommercial.email}
                            </span>
                          ) : null}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className={`${cardClass} space-y-3 p-4`}>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">
                      Cita agendada
                    </p>
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-muted">Fecha y hora</dt>
                        <dd className="font-bold text-ink">{proposedRange || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Modalidad</dt>
                        <dd className="font-bold text-ink">
                          {ubicacion === 'Teams' ? 'Virtual (Teams)' : 'Presencial'}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-muted">Lugar</dt>
                        <dd className="font-bold text-ink">
                          {resolveSqlLugar(ubicacion, lugarDetalle)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className={`${cardClass} space-y-3 p-4`}>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">
                      Contactos citados
                    </p>
                    <ul className="space-y-3">
                      {contacts
                        .filter((contact) => contact.nombre.trim())
                        .map((contact, index) => (
                          <li
                            key={contact.id}
                            className="rounded border border-border bg-bg p-3 text-sm"
                          >
                            <p className="font-bold text-ink">
                              {index === 0 ? 'Contacto principal' : 'Contacto adicional'}
                              {' · '}
                              {contact.nombre.trim()}
                            </p>
                            <div className="mt-1 space-y-0.5 text-xs text-muted">
                              {contact.cargo.trim() ? (
                                <p>Cargo: {contact.cargo.trim()}</p>
                              ) : null}
                              {contact.email.trim() ? (
                                <p>Correo: {contact.email.trim()}</p>
                              ) : null}
                              {contact.telefono.trim() ? (
                                <p>Teléfono: {contact.telefono.trim()}</p>
                              ) : null}
                            </div>
                          </li>
                        ))}
                    </ul>
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
                      onClick={() => setTab('contactos')}
                    >
                      Volver
                    </button>
                    <button
                      type="button"
                      className={primaryButtonClass}
                      disabled={busy}
                      onClick={() =>
                        void (scheduleOnly
                          ? handleScheduleOnlyWithCita()
                          : handleAssignWithCita())
                      }
                    >
                      {busy
                        ? scheduleOnly
                          ? 'Agendando…'
                          : 'Asignando…'
                        : scheduleOnly
                          ? 'Agendar cita'
                          : 'Asignar y registrar cita'}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : showSimpleAssign ? (
            <div className="space-y-4">
              {appointmentHint ? (
                <div className="rounded border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-ink">
                  Hay una posible reunión registrada al aprobar el MQL (
                  {appointmentHint}). Puedes asignar ahora y agendar después.
                </div>
              ) : null}
              <div>
                <label className={labelClass} htmlFor="assign-commercial-simple">
                  Ejecutivo Comercial
                </label>
                <select
                  id="assign-commercial-simple"
                  className={inputClass}
                  value={comercialId}
                  disabled={!commercialsLoaded}
                  onChange={(event) => setComercialId(event.target.value)}
                >
                  <option value="">
                    {commercialsLoaded ? 'Seleccionar…' : 'Cargando…'}
                  </option>
                  {commercials.map((commercial) => (
                    <option key={commercial.user_id} value={commercial.user_id}>
                      {commercial.full_name}
                      {commercial.email ? ` · ${commercial.email}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={registerCita}
                  disabled={pendingAgencyCita}
                  onChange={(event) => {
                    setRegisterCita(event.target.checked);
                    setError(null);
                    setTab('datos');
                  }}
                />
                Registrar cita al asignar
              </label>
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
                  onClick={handleClose}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={primaryButtonClass}
                  disabled={busy}
                  onClick={() => void handleAssignWithoutCita()}
                >
                  {busy ? 'Asignando…' : 'Confirmar asignación'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
