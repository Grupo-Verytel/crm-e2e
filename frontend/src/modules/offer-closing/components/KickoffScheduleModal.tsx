import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { DatePickerField } from '../../../components/DatePickerField';
import { TimePickerField } from '../../../components/TimePickerField';
import { fetchPeople } from '../../accounts/api/accounts-api';
import { fetchOuvContactos } from '../../discovery/api/ouvs-api';
import type {
  KickoffInvitee,
  KickoffInviteeTipo,
  KickoffRecord,
  KickoffSalaVerytel,
  KickoffUbicacionTipo,
} from '../../shared/project/types';
import {
  KICKOFF_COMPANY_USERS,
  KICKOFF_SALAS_VERYTEL,
  mockTeamsMeetingLink,
  validateKickoffSlot,
  type SlotValidation,
} from '../lib/kickoff-scheduling';
import { KickoffAvailabilityGrid } from './KickoffAvailabilityGrid';
import { KickoffProgramacionPanel } from './KickoffProgramacionPanel';
import {
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

type InviteCandidate = {
  id: string;
  nombre: string;
  email: string;
  tipo: KickoffInviteeTipo;
  origenLabel: string;
};

type ScheduleTab = 'datos' | 'disponibilidad' | 'confirmacion';

type Props = {
  open: boolean;
  onClose: () => void;
  ouvId: string;
  accountId?: string | null;
  empresaNombre?: string | null;
  kickoff: KickoffRecord;
  onChange: (kickoff: KickoffRecord) => void;
};

function formatUbicacionLabel(
  ubicaciones: KickoffUbicacionTipo[],
  salaVerytel: KickoffSalaVerytel | '',
  ubicacionDetalle: string,
): string {
  const parts: string[] = [];
  if (ubicaciones.includes('Teams')) {
    parts.push('Reunión de Microsoft Teams');
  }
  if (ubicaciones.includes('Presencial')) {
    parts.push(
      salaVerytel
        ? `Oficinas Verytel — ${salaVerytel}`
        : ubicacionDetalle.trim() || 'Presencial',
    );
  }
  return parts.join(' · ');
}

function combineSameDay(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateFromIso(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function timeFromIso(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function inviteeTipoLabel(tipo: KickoffInviteeTipo): string {
  if (tipo === 'Interno') return 'Verytel / Frisson';
  if (tipo === 'ContactoOuv') return 'Empresa OUV';
  return 'Empresa OUV';
}

const TAB_CLASS =
  'rounded px-3 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40';

/** Modal de agendamiento: 3 pestañas (Datos → Disponibilidad → Programación). */
export function KickoffScheduleModal({
  open,
  onClose,
  ouvId,
  accountId = null,
  empresaNombre = null,
  kickoff,
  onChange,
}: Props) {
  const [tab, setTab] = useState<ScheduleTab>('datos');
  const [nombreReunion, setNombreReunion] = useState('');
  const [fecha, setFecha] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [ubicaciones, setUbicaciones] = useState<KickoffUbicacionTipo[]>([
    'Teams',
  ]);
  const [salaVerytel, setSalaVerytel] = useState<KickoffSalaVerytel | ''>('');
  const [ubicacionDetalle, setUbicacionDetalle] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [invitados, setInvitados] = useState<KickoffInvitee[]>([]);
  const [candidates, setCandidates] = useState<InviteCandidate[]>([]);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [validation, setValidation] = useState<SlotValidation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inviteBoxRef = useRef<HTMLDivElement>(null);
  const hydratedForOpen = useRef(false);

  useEffect(() => {
    if (!open) {
      hydratedForOpen.current = false;
      return;
    }
    if (hydratedForOpen.current) return;
    hydratedForOpen.current = true;

    setNombreReunion(
      kickoff.agenda?.nombreReunion ?? kickoff.sesionNombre ?? '',
    );
    setFecha(dateFromIso(kickoff.agenda?.inicio));
    setHoraInicio(timeFromIso(kickoff.agenda?.inicio));
    setHoraFin(timeFromIso(kickoff.agenda?.fin));
    setUbicaciones(
      kickoff.agenda?.ubicaciones?.length
        ? [...kickoff.agenda.ubicaciones]
        : ['Teams'],
    );
    setSalaVerytel(kickoff.agenda?.salaVerytel ?? '');
    setUbicacionDetalle(kickoff.agenda?.ubicacionDetalle ?? '');
    setObservaciones(kickoff.agenda?.observacionesInvitados ?? '');
    setInvitados(kickoff.agenda?.invitados ?? []);
    setValidation(null);
    setError(null);
    setInviteQuery('');
    setTab(kickoff.agendamientoConfirmado ? 'confirmacion' : 'datos');
  }, [open, kickoff]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadCandidates() {
      const map = new Map<string, InviteCandidate>();
      for (const u of KICKOFF_COMPANY_USERS) {
        map.set(u.email.toLowerCase(), {
          id: u.id,
          nombre: u.nombre,
          email: u.email,
          tipo: 'Interno',
          origenLabel: u.empresa,
        });
      }
      try {
        if (accountId) {
          const people = await fetchPeople({
            account_id: accountId,
            page: 1,
            limit: 100,
          });
          for (const p of people.items) {
            const email =
              p.email?.trim().toLowerCase() ||
              `${p.person_id}@cuenta.local`;
            if (map.has(email)) continue;
            map.set(email, {
              id: p.person_id,
              nombre: p.name,
              email: p.email ?? email,
              tipo: 'Externo',
              origenLabel: p.account_name ?? empresaNombre ?? 'Empresa OUV',
            });
          }
        }
      } catch {
        /* optional */
      }
      try {
        const contactos = await fetchOuvContactos(ouvId);
        for (const c of contactos) {
          const email =
            c.email?.trim().toLowerCase() ||
            `${c.contacto_ouv_id}@contacto.local`;
          if (map.has(email)) continue;
          map.set(email, {
            id: c.contacto_ouv_id,
            nombre: c.name,
            email: c.email ?? email,
            tipo: 'ContactoOuv',
            origenLabel: empresaNombre ?? 'Contacto OUV',
          });
        }
      } catch {
        /* optional */
      }
      if (!cancelled) setCandidates([...map.values()]);
    }

    void loadCandidates();
    return () => {
      cancelled = true;
    };
  }, [open, accountId, empresaNombre, ouvId]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!inviteBoxRef.current?.contains(event.target as Node)) {
        setInviteOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const inicio = combineSameDay(fecha, horaInicio);
  const fin = combineSameDay(fecha, horaFin);
  const weekAnchor = inicio ?? new Date();
  const disponibilidadUnlocked = validation !== null;
  const confirmacionUnlocked = kickoff.agendamientoConfirmado;

  const selectedIds = useMemo(
    () => new Set(invitados.map((i) => i.id)),
    [invitados],
  );

  const filteredCandidates = useMemo(() => {
    const q = inviteQuery.trim().toLowerCase();
    const available = candidates.filter((c) => !selectedIds.has(c.id));
    if (!q) return available.slice(0, 8);
    return available
      .filter(
        (c) =>
          c.nombre.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.origenLabel.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [candidates, inviteQuery, selectedIds]);

  function invalidateAvailability() {
    setValidation(null);
    if (tab === 'disponibilidad') setTab('datos');
  }

  function addInvitee(candidate: InviteCandidate) {
    setInvitados((prev) => {
      if (prev.some((i) => i.id === candidate.id || i.email === candidate.email)) {
        return prev;
      }
      return [
        ...prev,
        {
          id: candidate.id,
          email: candidate.email,
          nombre: candidate.nombre,
          tipo: candidate.tipo,
        },
      ];
    });
    setInviteQuery('');
    setInviteOpen(false);
    invalidateAvailability();
  }

  function removeInvitee(id: string) {
    setInvitados((prev) => prev.filter((i) => i.id !== id));
    invalidateAvailability();
  }

  function toggleUbicacion(tipo: KickoffUbicacionTipo) {
    setUbicaciones((prev) => {
      if (prev.includes(tipo)) {
        return prev.filter((t) => t !== tipo);
      }
      return [...prev, tipo];
    });
    invalidateAvailability();
  }

  function runValidation() {
    setError(null);
    if (!nombreReunion.trim()) {
      setError('Indique el nombre de la reunión.');
      return;
    }
    if (invitados.length === 0) {
      setError('Agregue al menos un invitado.');
      return;
    }
    if (ubicaciones.length === 0) {
      setError('Seleccione al menos una ubicación (Teams y/o Presencial).');
      return;
    }
    if (!fecha || !horaInicio || !horaFin) {
      setError('Indique fecha, hora de inicio y hora de fin.');
      return;
    }
    if (!inicio || !fin || fin <= inicio) {
      setError('La hora de fin debe ser posterior a la de inicio (mismo día).');
      return;
    }
    const result = validateKickoffSlot({
      inicio,
      fin,
      invitados,
      ubicaciones,
      salaVerytel:
        ubicaciones.includes('Presencial') && salaVerytel ? salaVerytel : null,
      ubicacionDetalle,
    });
    setValidation(result);
    setTab('disponibilidad');
  }

  function confirmAgenda() {
    if (!validation?.ok || !inicio || !fin) return;
    const enlace = ubicaciones.includes('Teams')
      ? mockTeamsMeetingLink(nombreReunion)
      : '';
    const ubicacionLabel = formatUbicacionLabel(
      ubicaciones,
      salaVerytel,
      ubicacionDetalle,
    );

    onChange({
      ...kickoff,
      sesionNombre: nombreReunion.trim(),
      sesionFecha: fecha,
      enlace,
      estado: 'Programado',
      fechaRealizacion: null,
      validadoTeams: false,
      agendamientoConfirmado: true,
      agenda: {
        nombreReunion: nombreReunion.trim(),
        invitados,
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        ubicaciones: [...ubicaciones],
        salaVerytel: ubicaciones.includes('Presencial')
          ? salaVerytel || null
          : null,
        ubicacionDetalle: ubicacionLabel,
        observacionesInvitados: observaciones.trim(),
        confirmadaEn: new Date().toISOString(),
      },
    });
    setTab('confirmacion');
  }

  if (!open) return null;

  function tabBtn(id: ScheduleTab, label: string, unlocked: boolean) {
    const active = tab === id;
    return (
      <button
        type="button"
        className={`${TAB_CLASS} ${
          active
            ? 'bg-accent text-white'
            : 'bg-bg text-muted hover:text-ink'
        }`}
        disabled={!unlocked && !active}
        onClick={() => unlocked && setTab(id)}
      >
        {label}
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Agendar Kickoff"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-[54rem] flex-col overflow-hidden rounded bg-surface shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="text-base font-bold text-ink">Agendar Kickoff</h2>
          <button
            type="button"
            className="text-sm text-muted hover:text-ink"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border px-5 py-3">
          {tabBtn('datos', '1 · Agendamiento', true)}
          {tabBtn('disponibilidad', '2 · Disponibilidad', disponibilidadUnlocked)}
          {tabBtn('confirmacion', '3 · Confirmación', confirmacionUnlocked)}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {tab === 'datos' ? (
            <div className="space-y-4">
              <div className="grid items-end gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(12rem,1.1fr)_minmax(7rem,0.7fr)_minmax(7rem,0.7fr)]">
                <div>
                  <label className={labelClass} htmlFor="ko-meeting-name">
                    Nombre de la reunión
                  </label>
                  <input
                    id="ko-meeting-name"
                    className={inputClass}
                    value={nombreReunion}
                    onChange={(e) => {
                      setNombreReunion(e.target.value);
                      invalidateAvailability();
                    }}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="ko-fecha">
                    Fecha
                  </label>
                  <DatePickerField
                    id="ko-fecha"
                    value={fecha}
                    onChange={(next) => {
                      setFecha(next);
                      invalidateAvailability();
                    }}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="ko-hora-inicio">
                    Hora inicio
                  </label>
                  <TimePickerField
                    id="ko-hora-inicio"
                    value={horaInicio}
                    onChange={(next) => {
                      setHoraInicio(next);
                      invalidateAvailability();
                    }}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="ko-hora-fin">
                    Hora fin
                  </label>
                  <TimePickerField
                    id="ko-hora-fin"
                    value={horaFin}
                    onChange={(next) => {
                      setHoraFin(next);
                      invalidateAvailability();
                    }}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="ko-invite-search">
                  Invitados
                </label>
                <p className="mb-2 text-xs text-muted">
                  Busca usuarios Verytel/Frisson o contactos de{' '}
                  {empresaNombre ? (
                    <span className="font-bold text-ink">{empresaNombre}</span>
                  ) : (
                    'la empresa de la OUV'
                  )}
                  .
                </p>
                <div className="relative" ref={inviteBoxRef}>
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-accent"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <input
                    id="ko-invite-search"
                    className={`${inputClass} pl-9`}
                    value={inviteQuery}
                    placeholder="Buscar por nombre o correo…"
                    onChange={(e) => {
                      setInviteQuery(e.target.value);
                      setInviteOpen(true);
                    }}
                    onFocus={() => setInviteOpen(true)}
                    autoComplete="off"
                  />
                  {inviteOpen ? (
                    <ul
                      className="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded border border-border bg-surface shadow-card"
                      role="listbox"
                    >
                      {filteredCandidates.length === 0 ? (
                        <li className="px-3 py-2 text-sm text-muted">
                          Sin coincidencias.
                        </li>
                      ) : (
                        filteredCandidates.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-bg"
                              onClick={() => addInvitee(c)}
                            >
                              <span className="text-sm font-bold text-ink">
                                {c.nombre}
                              </span>
                              <span className="text-xs text-muted">
                                {c.email} · {c.origenLabel}
                              </span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  ) : null}
                </div>
                {invitados.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {invitados.map((inv) => (
                      <li
                        key={inv.id}
                        className="inline-flex items-center gap-1 rounded border border-border bg-bg px-2 py-1 text-xs"
                      >
                        <span className="font-bold text-ink">{inv.nombre}</span>
                        <span className="text-muted">
                          · {inviteeTipoLabel(inv.tipo)}
                        </span>
                        <button
                          type="button"
                          className="text-muted hover:text-danger"
                          aria-label={`Quitar ${inv.nombre}`}
                          onClick={() => removeInvitee(inv.id)}
                        >
                          <X size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted">
                    Ningún invitado seleccionado.
                  </p>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className={labelClass}>Ubicación</p>
                  <div className="mb-2 flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={ubicaciones.includes('Teams')}
                        onChange={() => toggleUbicacion('Teams')}
                      />
                      Microsoft Teams
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={ubicaciones.includes('Presencial')}
                        onChange={() => toggleUbicacion('Presencial')}
                      />
                      Presencial
                    </label>
                  </div>
                  {ubicaciones.includes('Presencial') ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select
                        className={inputClass}
                        value={salaVerytel}
                        onChange={(e) => {
                          setSalaVerytel(
                            e.target.value as KickoffSalaVerytel | '',
                          );
                          invalidateAvailability();
                        }}
                      >
                        <option value="">Otra ubicación</option>
                        {KICKOFF_SALAS_VERYTEL.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      {!salaVerytel ? (
                        <input
                          className={inputClass}
                          value={ubicacionDetalle}
                          onChange={(e) => {
                            setUbicacionDetalle(e.target.value);
                            invalidateAvailability();
                          }}
                          placeholder="Dirección"
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div>
                  <label className={labelClass} htmlFor="ko-obs">
                    Observaciones para los invitados
                  </label>
                  <textarea
                    id="ko-obs"
                    className={`${inputClass} min-h-[4.5rem] py-2`}
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                  />
                </div>
              </div>

              {error ? (
                <p className="text-sm text-danger" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="flex justify-end">
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={runValidation}
                >
                  Validar disponibilidad
                </button>
              </div>
            </div>
          ) : null}

          {tab === 'disponibilidad' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-ink">Disponibilidad</h3>
                <button
                  type="button"
                  className={primaryButtonClass}
                  disabled={!validation?.ok}
                  onClick={confirmAgenda}
                >
                  Confirmar agenda
                </button>
              </div>

              {validation ? (
                <div className="rounded border border-border bg-bg p-3 text-sm">
                  {validation.ok ? (
                    <p className="text-positive">
                      Horario disponible para confirmar.
                    </p>
                  ) : (
                    <ul className="list-disc pl-4 text-danger">
                      {validation.conflicts.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  )}
                  {validation.skipped.map((s) => (
                    <p key={s} className="mt-1 text-xs text-muted">
                      {s}
                    </p>
                  ))}
                </div>
              ) : null}

              <KickoffAvailabilityGrid
                weekAnchor={weekAnchor}
                invitados={invitados}
                salaVerytel={
                  ubicaciones.includes('Presencial') && salaVerytel
                    ? salaVerytel
                    : null
                }
                proposedStart={inicio}
                proposedEnd={fin}
                onSelectSlot={(start, end) => {
                  const pad = (n: number) => String(n).padStart(2, '0');
                  const nextFecha = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
                  const nextInicio = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
                  const nextFin = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
                  setFecha(nextFecha);
                  setHoraInicio(nextInicio);
                  setHoraFin(nextFin);
                  const result = validateKickoffSlot({
                    inicio: start,
                    fin: end,
                    invitados,
                    ubicaciones,
                    salaVerytel:
                      ubicaciones.includes('Presencial') && salaVerytel
                        ? salaVerytel
                        : null,
                    ubicacionDetalle,
                  });
                  setValidation(result);
                }}
              />
            </div>
          ) : null}

          {tab === 'confirmacion' && kickoff.agendamientoConfirmado ? (
            <KickoffProgramacionPanel kickoff={kickoff} onChange={onChange} />
          ) : null}

          {tab === 'confirmacion' && !kickoff.agendamientoConfirmado ? (
            <p className="text-sm text-muted">
              Confirma la agenda en Disponibilidad para ver la confirmación.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
