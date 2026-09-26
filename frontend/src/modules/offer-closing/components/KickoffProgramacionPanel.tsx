import { useState } from 'react';
import { Copy } from 'lucide-react';
import type { KickoffRecord } from '../../shared/project/types';
import type { GraphAttendance } from '../api/graph-api';
import { formatKickoffRange } from '../lib/kickoff-scheduling';
import {
  badgeClass,
  cardClass,
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

type Props = {
  kickoff: KickoffRecord;
  onChange: (kickoff: KickoffRecord) => void;
  attendance?: GraphAttendance | null;
};

function formatSesionFecha(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || '—';
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
}

function formatDuracion(segundos: number): string {
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, '0')} min`;
}

function formatMomento(iso: string | null): string {
  if (!iso) return '—';
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? iso : fecha.toLocaleString();
}

function isTeamsJoinUrl(url: string): boolean {
  return /teams\.microsoft\.com|teams\.live\.com/i.test(url);
}

function meetingJoinUrl(kickoff: KickoffRecord): string {
  const fromAgenda = kickoff.agenda?.joinUrl?.trim() ?? '';
  if (fromAgenda) return fromAgenda;
  const fromEnlace = kickoff.enlace.trim();
  return isTeamsJoinUrl(fromEnlace) ? fromEnlace : '';
}

type CruceAsistencia = {
  asistieron: { id: string; nombre: string; email: string }[];
  faltaron: { id: string; nombre: string; email: string }[];
} | null;

/** Informe de Teams ya contrastado contra los invitados de la agenda. */
function AttendanceReport({
  attendance,
  cruce,
}: {
  attendance: GraphAttendance;
  cruce: CruceAsistencia;
}) {
  return (
    <div className="space-y-3 rounded border border-border bg-bg p-3">
      <div className="grid gap-1 text-xs text-muted sm:grid-cols-3">
        <span>Inicio: {formatMomento(attendance.meetingStartDateTime)}</span>
        <span>Fin: {formatMomento(attendance.meetingEndDateTime)}</span>
        <span>Participantes: {attendance.totalParticipantCount ?? '—'}</span>
      </div>

      {cruce ? (
        <div className="flex flex-wrap gap-2">
          <span className={`${badgeClass} bg-positive/15 text-positive`}>
            {cruce.asistieron.length} de{' '}
            {cruce.asistieron.length + cruce.faltaron.length} invitados
            asistieron
          </span>
          {cruce.faltaron.length > 0 ? (
            <span className={`${badgeClass} bg-warning/20 text-ink`}>
              No asistieron: {cruce.faltaron.map((i) => i.nombre).join(', ')}
            </span>
          ) : null}
        </div>
      ) : null}

      <div>
        <p className={labelClass}>Asistentes según Teams</p>
        {attendance.attendees.length === 0 ? (
          <p className="text-xs text-muted">
            El informe no registra participantes.
          </p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm">
            {attendance.attendees.map((a) => (
              <li key={`${a.email ?? a.name}-${a.role ?? ''}`}>
                <span className="text-ink">{a.name || a.email || '—'}</span>
                {a.email ? (
                  <span className="text-muted"> · {a.email}</span>
                ) : null}
                <span className="text-muted">
                  {' '}
                  · {formatDuracion(a.totalAttendanceInSeconds)}
                  {a.intervals > 1 ? ` · ${a.intervals} conexiones` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Etapa 3 — confirmación de la reunión agendada (campos solo lectura).
 * Etapa 4 — aprobaciones (solo tras reunión realizada + validación Teams).
 */
export function KickoffProgramacionPanel({
  kickoff,
  onChange,
  attendance = null,
}: Props) {
  const [copiedLink, setCopiedLink] = useState(false);
  const enlace = meetingJoinUrl(kickoff);
  const puedeCopiar = Boolean(enlace);

  const phase4Unlocked =
    kickoff.estado === 'Realizado' && kickoff.validadoTeams;
  const allAprobaciones =
    kickoff.aprobaciones.length > 0 &&
    kickoff.aprobaciones.every((a) => a.completada);

  function patch(partial: Partial<KickoffRecord>) {
    onChange({ ...kickoff, ...partial });
  }

  function toggleAprobacion(id: string) {
    if (!phase4Unlocked) return;
    onChange({
      ...kickoff,
      aprobaciones: kickoff.aprobaciones.map((a) =>
        a.id === id ? { ...a, completada: !a.completada } : a,
      ),
    });
  }

  /**
   * Contrasta el informe de Teams con los invitados de la agenda. El cruce es
   * por correo porque el nombre en Teams no siempre coincide con el del CRM.
   */
  const cruce = (() => {
    if (!attendance) return null;
    const presentes = new Set(
      attendance.attendees
        .map((a) => a.email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email)),
    );
    const invitados = kickoff.agenda?.invitados ?? [];
    return {
      asistieron: invitados.filter((inv) =>
        presentes.has(inv.email.trim().toLowerCase()),
      ),
      faltaron: invitados.filter(
        (inv) => !presentes.has(inv.email.trim().toLowerCase()),
      ),
    };
  })();

  const readOnlyClass = `${inputClass} cursor-default opacity-90`;

  return (
    <div className="space-y-3">
      <section className={`${cardClass} p-4`}>
        <h3 className="mb-3 text-sm font-bold text-ink">
          Confirmación de la reunión
        </h3>

        {kickoff.agenda ? (
          <p className="mb-3 text-xs text-muted">
            {formatKickoffRange(kickoff.agenda.inicio, kickoff.agenda.fin)}
            {kickoff.agenda.ubicacionDetalle
              ? ` · ${kickoff.agenda.ubicacionDetalle}`
              : null}
          </p>
        ) : null}

        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="prog-sesion">
              Sesión
            </label>
            <input
              id="prog-sesion"
              className={readOnlyClass}
              value={kickoff.sesionNombre || '—'}
              readOnly
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="prog-fecha">
              Fecha sesión
            </label>
            <input
              id="prog-fecha"
              className={readOnlyClass}
              value={formatSesionFecha(kickoff.sesionFecha)}
              readOnly
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <label className={labelClass} htmlFor="prog-estado">
              Estado
            </label>
            <input
              id="prog-estado"
              className={readOnlyClass}
              value={kickoff.estado || 'Programado'}
              readOnly
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className={labelClass} htmlFor="prog-link">
              Enlace
            </label>
            <div className="flex items-center gap-2">
              <input
                id="prog-link"
                className={readOnlyClass}
                value={enlace || '—'}
                readOnly
              />
              <button
                type="button"
                className="icon-btn shrink-0 p-2"
                disabled={!puedeCopiar}
                title={
                  !puedeCopiar
                    ? 'No hay enlace para copiar'
                    : copiedLink
                      ? 'Copiado'
                      : 'Copiar enlace'
                }
                aria-label="Copiar enlace al portapapeles"
                onClick={() => {
                  void navigator.clipboard.writeText(enlace).then(
                    () => {
                      setCopiedLink(true);
                      window.setTimeout(() => setCopiedLink(false), 2000);
                    },
                    () => setCopiedLink(false),
                  );
                }}
              >
                <Copy size={16} strokeWidth={2} aria-hidden />
              </button>
            </div>
          </div>
        </div>

        {kickoff.agenda?.invitados.length ? (
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-bold text-muted">
              Invitados confirmados
            </p>
            <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {kickoff.agenda.invitados.map((inv) => (
                <li key={inv.id} className="text-ink">
                  {inv.nombre}{' '}
                  <span className="text-muted">· {inv.email}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {phase4Unlocked ? (
        <section className={`${cardClass} space-y-3 p-4`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-ink">
              Etapa 4 · Aprobaciones requeridas
            </h3>
            <span className={`${badgeClass} bg-positive/15 text-positive`}>
              Validado por Teams
            </span>
          </div>
          <p className="text-xs text-muted">
            Confirma el Kickoff solo cuando las tres aprobaciones estén
            completas. Hasta entonces no se puede avanzar a creación de
            proyecto.
          </p>
          {attendance?.reportId ? (
            <AttendanceReport attendance={attendance} cruce={cruce} />
          ) : null}
          <ul className="grid gap-2 sm:grid-cols-3">
            {kickoff.aprobaciones.map((a) => (
              <li key={a.id}>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={a.completada}
                    onChange={() => toggleAprobacion(a.id)}
                  />
                  {a.label}
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              className={primaryButtonClass}
              disabled
              title={
                allAprobaciones
                  ? 'Kickoff confirmado con las tres aprobaciones'
                  : 'Marca las tres aprobaciones para confirmar el Kickoff'
              }
            >
              {allAprobaciones ? 'Kickoff confirmado' : 'Confirmar Kickoff'}
            </button>
            {!allAprobaciones ? (
              <span className="text-xs text-muted">
                Completa Aval comercial, Transferencia técnica y PMO confirma
                recepción.
              </span>
            ) : (
              <span className="text-xs text-positive">
                Listo para creación de proyecto (PMO).
              </span>
            )}
          </div>
          <button
            type="button"
            className={`${ghostButtonClass} px-2 py-0.5 text-xs`}
            onClick={() => patch({ validadoTeams: false })}
          >
            Revocar validación Teams (mock)
          </button>
        </section>
      ) : null}
    </div>
  );
}
