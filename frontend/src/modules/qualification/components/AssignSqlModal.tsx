import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { DatePickerField } from '../../../components/DatePickerField';
import { TimePickerField } from '../../../components/TimePickerField';
import { ApiError } from '../../auth/types';
import { KickoffAvailabilityGrid } from '../../offer-closing/components/KickoffAvailabilityGrid';
import type { SlotValidation } from '../../offer-closing/lib/kickoff-scheduling';
import {
  assignSql,
  fetchCommercials,
  type CommercialOption,
  type SqlCita,
  type SqlDetail,
} from '../api/sqls-api';
import { formatScheduledCita } from '../lib/sql-appointments';
import {
  addMinutesToTime,
  buildCommercialWeekAnchor,
  buildMeetingDescription,
  combineSameDay,
  commercialAsInvitee,
  createContactId,
  dateFromIso,
  formatLeadAppointmentHint,
  formatSqlAppointmentRange,
  resolveSqlLugar,
  timeFromIso,
  validateCommercialSlot,
  type MeetingContactDraft,
  type SqlUbicacionTipo,
} from '../lib/sql-assignment-scheduling';
import {
  cardClass,
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';
import { SqlMeetingContactsEditor } from './SqlMeetingContactsEditor';

type Props = {
  sql: SqlDetail;
  onClose: () => void;
  onAssigned: () => void;
};

type ScheduleTab = 'datos' | 'disponibilidad' | 'contactos' | 'confirmacion';
type AssignPhase = 'form' | 'done';

type AssignResult = {
  withCita: boolean;
  cita: SqlCita | null;
  commercialName: string;
};

const TAB_CLASS =
  'rounded px-3 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40';

function leadString(lead: SqlDetail['lead'], key: string): string {
  const value = lead[key];
  return typeof value === 'string' ? value : '';
}

function initialContact(sql: SqlDetail): MeetingContactDraft {
  return {
    id: createContactId(),
    nombre: leadString(sql.lead, 'contacto_nombre'),
    email: leadString(sql.lead, 'email'),
    telefono: leadString(sql.lead, 'telefono'),
    cargo: '',
    descripcion: '',
  };
}

function resolveAssignError(err: unknown): string {
  if (err instanceof ApiError && err.message.trim()) {
    return err.message;
  }
  return 'No se pudo asignar el SQL. Revisa los datos e inténtalo de nuevo.';
}

export function AssignSqlModal({ sql, onClose, onAssigned }: Props) {
  const [commercials, setCommercials] = useState<CommercialOption[]>([]);
  const [comercialId, setComercialId] = useState('');
  const [registerCita, setRegisterCita] = useState(true);
  const [tab, setTab] = useState<ScheduleTab>('datos');
  const [ubicacion, setUbicacion] = useState<SqlUbicacionTipo>('Teams');
  const [lugarDetalle, setLugarDetalle] = useState('Microsoft Teams');
  const [fecha, setFecha] = useState('');
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFin, setHoraFin] = useState('10:00');
  const initialContactsBundle = useMemo(() => {
    const first = initialContact(sql);
    return { contacts: [first], selectedId: first.id };
  }, [sql.sql_id]);
  const [contacts, setContacts] = useState<MeetingContactDraft[]>(
    initialContactsBundle.contacts,
  );
  const [selectedContactId, setSelectedContactId] = useState(
    initialContactsBundle.selectedId,
  );
  const [validation, setValidation] = useState<SlotValidation | null>(null);
  const [contactsUnlocked, setContactsUnlocked] = useState(false);
  const [confirmacionUnlocked, setConfirmacionUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<AssignPhase>('form');
  const [result, setResult] = useState<AssignResult | null>(null);

  const leadFechaCita = leadString(sql.lead, 'fecha_cita');
  const leadComercialId = leadString(sql.lead, 'comercial_asignado_id');
  const appointmentHint = formatLeadAppointmentHint(leadFechaCita || undefined);

  const selectedCommercial = useMemo(
    () => commercials.find((c) => c.user_id === comercialId) ?? null,
    [commercials, comercialId],
  );

  const inicio = combineSameDay(fecha, horaInicio);
  const fin = combineSameDay(fecha, horaFin);
  const weekAnchor = buildCommercialWeekAnchor(fecha);
  const proposedRange = formatSqlAppointmentRange(fecha, horaInicio, horaFin);

  useEffect(() => {
    void fetchCommercials()
      .then((items) => {
        setCommercials(items);
        const preferred =
          leadComercialId && items.some((c) => c.user_id === leadComercialId)
            ? leadComercialId
            : items[0]?.user_id ?? '';
        setComercialId(preferred);
      })
      .catch(() => setError('No se pudo cargar la lista de comerciales.'));
  }, [leadComercialId]);

  useEffect(() => {
    if (leadFechaCita) {
      setFecha(dateFromIso(leadFechaCita));
      setHoraInicio(timeFromIso(leadFechaCita));
      setHoraFin(
        addMinutesToTime(
          dateFromIso(leadFechaCita),
          timeFromIso(leadFechaCita),
          60,
        ),
      );
    }
  }, [leadFechaCita]);

  function resolveCommercialName(userId: string): string {
    const match = commercials.find((commercial) => commercial.user_id === userId);
    return match?.full_name ?? userId;
  }

  function invalidateAvailability() {
    setValidation(null);
    setContactsUnlocked(false);
    setConfirmacionUnlocked(false);
    if (
      tab === 'disponibilidad' ||
      tab === 'contactos' ||
      tab === 'confirmacion'
    ) {
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
      prev.map((contact) =>
        contact.id === id ? { ...contact, ...patch } : contact,
      ),
    );
  }

  function addContact() {
    const id = createContactId();
    setContacts((prev) => [
      ...prev,
      {
        id,
        nombre: '',
        email: '',
        telefono: '',
        cargo: '',
        descripcion: '',
      },
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
      return 'Selecciona un Ejecutivo Comercial.';
    }
    if (!fecha || !horaInicio || !horaFin) {
      return 'Completa fecha, hora de inicio y hora fin.';
    }
    if (horaFin <= horaInicio) {
      return 'La hora fin debe ser posterior a la hora de inicio.';
    }
    if (ubicacion === 'Presencial' && !lugarDetalle.trim()) {
      return 'Indica la dirección o sede de la reunión presencial.';
    }
    if (!inicio || !fin || fin <= inicio) {
      return 'La hora fin debe ser posterior a la hora de inicio.';
    }
    return null;
  }

  function validateContactsStep(): string | null {
    const primary = contacts[0];
    if (!primary?.nombre.trim()) {
      return 'Indica el nombre del contacto principal.';
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
    if (!selectedCommercial || !inicio || !fin) {
      setError('Completa los datos de la cita antes de validar disponibilidad.');
      return;
    }

    const slotResult = validateCommercialSlot({
      inicio,
      fin,
      invitado: commercialAsInvitee({
        userId: selectedCommercial.user_id,
        fullName: selectedCommercial.full_name,
        email: selectedCommercial.email,
      }),
      ubicacion,
      lugarDetalle,
    });
    setValidation(slotResult);
    setTab('disponibilidad');
  }

  function continueToContacts() {
    setError(null);
    if (!validation?.ok) {
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

  function handleSlotSelect(start: Date, end: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    const nextFecha = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
    const nextInicio = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
    const nextFin = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
    setFecha(nextFecha);
    setHoraInicio(nextInicio);
    setHoraFin(nextFin);

    if (!selectedCommercial) return;
    const nextInicioDate = combineSameDay(nextFecha, nextInicio);
    const nextFinDate = combineSameDay(nextFecha, nextFin);
    if (!nextInicioDate || !nextFinDate) return;

    setValidation(
      validateCommercialSlot({
        inicio: nextInicioDate,
        fin: nextFinDate,
        invitado: commercialAsInvitee({
          userId: selectedCommercial.user_id,
          fullName: selectedCommercial.full_name,
          email: selectedCommercial.email,
        }),
        ubicacion,
        lugarDetalle,
      }),
    );
  }

  async function handleAssignWithoutCita() {
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
      setResult({
        withCita: false,
        cita: response.cita,
        commercialName: resolveCommercialName(comercialId),
      });
      setPhase('done');
      onAssigned();
    } catch (err) {
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
    if (!validation?.ok) {
      setError('Valida la disponibilidad antes de asignar.');
      setTab('datos');
      return;
    }
    if (!confirmacionUnlocked) {
      setError('Revisa la confirmación antes de asignar.');
      setTab('confirmacion');
      return;
    }

    const primary = contacts[0];
    setBusy(true);
    setError(null);
    try {
      const response = await assignSql(sql.sql_id, {
        comercial_asignado_id: comercialId,
        cita: {
          lugar: resolveSqlLugar(ubicacion, lugarDetalle),
          fecha,
          hora: horaInicio,
          contacto_nombre: primary.nombre.trim(),
          ...(primary.cargo.trim()
            ? { contacto_cargo: primary.cargo.trim() }
            : {}),
          ...(buildMeetingDescription(contacts, ubicacion === 'Teams')
            ? {
                descripcion: buildMeetingDescription(
                  contacts,
                  ubicacion === 'Teams',
                ),
              }
            : {}),
        },
      });
      setResult({
        withCita: true,
        cita: response.cita,
        commercialName: resolveCommercialName(comercialId),
      });
      setPhase('done');
      onAssigned();
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Asignar SQL"
    >
      <div
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded bg-surface shadow-card ${modalWidth}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-ink">Asignar SQL</h2>
            <p className="mt-1 text-sm text-muted">
              {leadString(sql.lead, 'empresa_nombre') || sql.sql_id}
              {leadString(sql.lead, 'contacto_nombre')
                ? ` · ${leadString(sql.lead, 'contacto_nombre')}`
                : ''}
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
            {tabBtn(
              'disponibilidad',
              '2 · Disponibilidad',
              validation !== null,
            )}
            {tabBtn('contactos', '3 · Contactos', contactsUnlocked)}
            {tabBtn(
              'confirmacion',
              '4 · Confirmación',
              confirmacionUnlocked,
            )}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {phase === 'done' && result ? (
            <div className="space-y-4">
              <div className="rounded border border-success/40 bg-success/10 px-4 py-3 text-sm text-ink">
                <p className="font-bold">SQL asignado correctamente</p>
                <p className="mt-1 text-muted">
                  Ejecutivo: {result.commercialName}
                </p>
              </div>

              {result.withCita ? (
                <div className="rounded border border-border bg-bg px-4 py-3 text-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    Cita agendada (CRM)
                  </p>
                  <p className="mt-2 font-bold text-ink">
                    {result.cita
                      ? formatScheduledCita(result.cita)
                      : 'No se recibió la cita en la respuesta del servidor.'}
                  </p>
                  {result.cita ? (
                    <p className="mt-1 text-muted">
                      Contacto: {result.cita.contacto_nombre}
                      {result.cita.contacto_cargo
                        ? ` · ${result.cita.contacto_cargo}`
                        : ''}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted">
                  La asignación quedó registrada sin cita agendada.
                </p>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={handleClose}
                >
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

                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={registerCita}
                      onChange={(event) => {
                        setRegisterCita(event.target.checked);
                        setError(null);
                        setTab('datos');
                        setValidation(null);
                        setContactsUnlocked(false);
                        setConfirmacionUnlocked(false);
                      }}
                    />
                    Registrar cita al asignar
                  </label>

                  <div>
                    <label className={labelClass} htmlFor="assign-commercial">
                      Ejecutivo Comercial
                    </label>
                    <select
                      id="assign-commercial"
                      className={inputClass}
                      value={comercialId}
                      onChange={(event) => {
                        setComercialId(event.target.value);
                        invalidateAvailability();
                      }}
                    >
                      <option value="">Seleccionar…</option>
                      {commercials.map((commercial) => (
                        <option
                          key={commercial.user_id}
                          value={commercial.user_id}
                        >
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
                    Ambiente de diseño: la cita se guarda en el CRM sin
                    integración real con Microsoft Teams.
                  </p>

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
                      disabled={!validation?.ok}
                      onClick={continueToContacts}
                    >
                      Continuar a contactos
                    </button>
                  </div>

                  {validation ? (
                    <div className="rounded border border-border bg-bg p-3 text-sm">
                      {validation.ok ? (
                        <p className="text-positive">
                          Horario disponible para el Ejecutivo Comercial.
                        </p>
                      ) : (
                        <ul className="list-disc pl-4 text-danger">
                          {validation.conflicts.map((conflict) => (
                            <li key={conflict}>{conflict}</li>
                          ))}
                        </ul>
                      )}
                      {validation.skipped.map((skipped) => (
                        <p key={skipped} className="mt-1 text-xs text-muted">
                          {skipped}
                        </p>
                      ))}
                    </div>
                  ) : null}

                  {selectedCommercial ? (
                    <KickoffAvailabilityGrid
                      weekAnchor={weekAnchor}
                      invitados={[
                        commercialAsInvitee({
                          userId: selectedCommercial.user_id,
                          fullName: selectedCommercial.full_name,
                          email: selectedCommercial.email,
                        }),
                      ]}
                      salaVerytel={null}
                      proposedStart={inicio}
                      proposedEnd={fin}
                      onSelectSlot={handleSlotSelect}
                    />
                  ) : (
                    <p className="text-sm text-muted">
                      Selecciona un Ejecutivo Comercial en el paso 1.
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
                      Revisa la cita y los contactos antes de asignar el SQL.
                    </p>
                  </div>

                  <div className={`${cardClass} space-y-3 p-4`}>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">
                      Asignación
                    </p>
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-muted">Empresa</dt>
                        <dd className="font-bold text-ink">
                          {leadString(sql.lead, 'empresa_nombre') || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">
                          Ejecutivo Comercial
                        </dt>
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
                        <dd className="font-bold text-ink">
                          {proposedRange || '—'}
                        </dd>
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
                              {index === 0
                                ? 'Contacto principal'
                                : 'Contacto adicional'}
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
                              {contact.descripcion.trim() ? (
                                <p>Notas: {contact.descripcion.trim()}</p>
                              ) : null}
                            </div>
                          </li>
                        ))}
                    </ul>
                    {selectedCommercial ? (
                      <p className="text-xs text-muted">
                        Participante interno: {selectedCommercial.full_name}
                        {selectedCommercial.email
                          ? ` (${selectedCommercial.email})`
                          : ''}
                      </p>
                    ) : null}
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
                      onClick={() => void handleAssignWithCita()}
                    >
                      {busy ? 'Asignando…' : 'Asignar y registrar cita'}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
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
                  onChange={(event) => setComercialId(event.target.value)}
                >
                  <option value="">Seleccionar…</option>
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
                  onChange={(event) => {
                    setRegisterCita(event.target.checked);
                    setError(null);
                    setTab('datos');
                    setValidation(null);
                    setContactsUnlocked(false);
                    setConfirmacionUnlocked(false);
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
          )}
        </div>
      </div>
    </div>
  );
}
