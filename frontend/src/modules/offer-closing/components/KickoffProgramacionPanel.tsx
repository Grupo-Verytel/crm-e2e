import type { KickoffRecord } from '../../shared/project/types';
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
};

function formatSesionFecha(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || '—';
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Etapa 3 — confirmación de la reunión agendada (campos solo lectura).
 * Etapa 4 — aprobaciones (solo tras reunión realizada + validación Teams).
 */
export function KickoffProgramacionPanel({ kickoff, onChange }: Props) {
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
            <input
              id="prog-link"
              className={readOnlyClass}
              value={kickoff.enlace || '—'}
              readOnly
            />
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

      {kickoff.estado === 'Realizado' && !kickoff.validadoTeams ? (
        <section className={`${cardClass} space-y-3 p-4`}>
          <h3 className="text-sm font-bold text-ink">
            Validación de asistencia (Teams)
          </h3>
          <p className="text-sm text-muted">
            La reunión ya figura como realizada. El sistema debe contrastar el
            listado de asistentes en Teams con los invitados confirmados antes
            de habilitar las aprobaciones del Kickoff.
          </p>
          <p className="text-sm">
            Validación Teams:{' '}
            <span className="text-muted">Pendiente de validación</span>
          </p>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => patch({ validadoTeams: true })}
          >
            Validar asistencia Teams (mock)
          </button>
        </section>
      ) : null}

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
      ) : kickoff.estado === 'Programado' || kickoff.estado === 'Cancelado' ? (
        <p className="rounded border border-border bg-surface px-3 py-2 text-xs text-muted">
          Las aprobaciones (Aval comercial, Transferencia técnica, PMO) y
          Confirmar Kickoff se habilitan en la etapa 4, después de marcar la
          reunión como Realizado y validar asistencia en Teams.
        </p>
      ) : null}
    </div>
  );
}
