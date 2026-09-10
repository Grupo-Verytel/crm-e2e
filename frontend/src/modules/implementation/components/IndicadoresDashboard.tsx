import type { IndicadorVs, IndicadorVsKey } from '../lib/project-metrics';
import { cardClass } from './ui';

const BLOQUES: {
  key: IndicadorVsKey;
  label: string;
}[] = [
  { key: 'facturacion', label: 'Facturación' },
  { key: 'costos', label: 'Costos' },
  { key: 'tiempo', label: 'Tiempo' },
  { key: 'alcance', label: 'Alcance' },
  { key: 'documentacion', label: 'CDP' },
];

type Props = {
  vs: Record<IndicadorVsKey, IndicadorVs>;
};

/** C3 — Indicadores from mock Control de Proyectos. */
export function IndicadoresDashboard({ vs }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {BLOQUES.map(({ key, label }) => {
        const pair = vs[key];
        return (
          <div key={key} className={cardClass}>
            <h3 className="text-sm font-bold text-ink">{label}</h3>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-muted">
              Actual
            </p>
            <p className="text-2xl font-bold text-accent">{pair.actual}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  Real
                </p>
                <p className="mt-0.5 text-sm font-bold text-ink">{pair.real}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  Proyectado
                </p>
                <p className="mt-0.5 text-sm font-bold text-ink">
                  {pair.proyectado}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
