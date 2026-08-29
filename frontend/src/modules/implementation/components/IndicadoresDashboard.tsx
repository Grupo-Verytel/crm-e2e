import { Lock } from 'lucide-react';
import type { IndicadoresProyecto } from '../../shared/project/types';
import { cardClass, badgeClass } from './ui';

const BLOQUES: { key: keyof IndicadoresProyecto; label: string }[] = [
  { key: 'facturacion', label: 'Facturación' },
  { key: 'costos', label: 'Costos' },
  { key: 'tiempo', label: 'Tiempo' },
  { key: 'alcance', label: 'Alcance' },
  { key: 'documentacion', label: 'Documentación' },
];

/** C3 — Indicadores from mock Control de Proyectos. */
export function IndicadoresDashboard({ indicadores }: { indicadores: IndicadoresProyecto }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {BLOQUES.map(({ key, label }) => {
        const block = indicadores[key];
        const valor = block.valor ?? 'Sin dato disponible';
        return (
          <div key={key} className={cardClass}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{label}</h3>
              {block.soloLectura !== false ? (
                <Lock size={14} className="text-muted" aria-label="Calculado por Control de Proyectos" />
              ) : null}
            </div>
            <p className="text-2xl font-bold text-accent">{valor}</p>
            <span className={`${badgeClass} mt-2 bg-border text-muted`}>{block.estado}</span>
            {block.actualizadoEn ? (
              <p className="mt-2 text-xs text-muted">
                Actualizado: {new Date(block.actualizadoEn).toLocaleDateString('es-CO')}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-muted">Fuente: Control de Proyectos (mock)</p>
          </div>
        );
      })}
    </div>
  );
}
