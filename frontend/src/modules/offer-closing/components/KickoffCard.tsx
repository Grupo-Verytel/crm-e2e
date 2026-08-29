import type { KickoffRecord, VentaGanadaRecord } from '../../shared/project/types';
import { puedeEnviarAPmo } from '../../shared/project/mock-store';
import { AlertaBanner } from '../../shared/project/AlertaBadge';
import { badgeClass, cardClass, ghostButtonClass, inputClass, labelClass, primaryButtonClass } from './ui';

const ESTADO_TONE: Record<KickoffRecord['estado'], string> = {
  Programado: 'bg-brand/15 text-brand',
  Realizado: 'bg-positive/15 text-positive',
  Cancelado: 'bg-border text-muted',
};

type Props = {
  record: VentaGanadaRecord;
  onChange: (kickoff: KickoffRecord) => void;
  onOpenResumen: () => void;
};

/** HU-F02 — Kickoff panel. */
export function KickoffCard({ record, onChange, onOpenResumen }: Props) {
  const { kickoff } = record;
  const pmo = puedeEnviarAPmo(record);

  function patch(partial: Partial<KickoffRecord>) {
    onChange({ ...kickoff, ...partial });
  }

  function toggleAprobacion(id: string) {
    onChange({
      ...kickoff,
      aprobaciones: kickoff.aprobaciones.map((a) =>
        a.id === id ? { ...a, completada: !a.completada } : a,
      ),
    });
  }

  return (
    <section className={cardClass}>
      <h3 className="mb-3 text-sm font-bold text-ink">Kickoff de entrega</h3>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="kickoff-nombre">Sesión</label>
          <input
            id="kickoff-nombre"
            className={inputClass}
            value={kickoff.sesionNombre}
            onChange={(e) => patch({ sesionNombre: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="kickoff-fecha">Fecha sesión</label>
          <input
            id="kickoff-fecha"
            type="date"
            className={inputClass}
            value={kickoff.sesionFecha}
            onChange={(e) => patch({ sesionFecha: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="kickoff-link">Enlace</label>
          <input
            id="kickoff-link"
            className={inputClass}
            value={kickoff.enlace}
            onChange={(e) => patch({ enlace: e.target.value })}
            placeholder="https://teams.microsoft.com/…"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="kickoff-estado">Estado</label>
          <select
            id="kickoff-estado"
            className={inputClass}
            value={kickoff.estado}
            onChange={(e) => {
              const estado = e.target.value as KickoffRecord['estado'];
              patch({
                estado,
                fechaRealizacion:
                  estado === 'Realizado' ? new Date().toISOString().slice(0, 10) : null,
              });
            }}
          >
            <option value="Programado">Programado</option>
            <option value="Realizado">Realizado</option>
            <option value="Cancelado">Cancelado</option>
          </select>
        </div>
        <div className="flex items-end">
          <span className={`${badgeClass} ${ESTADO_TONE[kickoff.estado]}`}>
            {kickoff.estado}
          </span>
        </div>
      </div>

      <p className="mb-2 text-xs font-bold text-muted">Aprobaciones requeridas</p>
      <ul className="mb-4 space-y-2">
        {kickoff.aprobaciones.map((a) => (
          <li key={a.id}>
            <label className="flex items-center gap-2 text-sm">
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

      <p className="mb-3 text-sm">
        Validación Teams:{' '}
        <span className={kickoff.validadoTeams ? 'text-positive' : 'text-muted'}>
          {kickoff.validadoTeams ? 'Validado por Teams' : 'Pendiente de validación'}
        </span>
        <button
          type="button"
          className={`${ghostButtonClass} ml-2 px-2 py-0.5 text-xs`}
          onClick={() => patch({ validadoTeams: !kickoff.validadoTeams })}
        >
          Toggle mock
        </button>
      </p>

      {!pmo.ok && pmo.reason ? (
        <AlertaBanner
          alerta={{
            id: 'kickoff-block',
            tipo: 'Envío bloqueado',
            estado: 'Activa',
            descripcion: pmo.reason,
            fecha: new Date().toISOString(),
          }}
        />
      ) : null}

      <button
        type="button"
        className={primaryButtonClass}
        disabled={!pmo.ok}
        title={pmo.reason ?? 'Confirmar envío a Control de Proyectos'}
        onClick={onOpenResumen}
      >
        Creación de Proyecto
      </button>
      {!pmo.ok ? (
        <p className="mt-2 text-xs text-muted">{pmo.reason}</p>
      ) : null}
    </section>
  );
}
