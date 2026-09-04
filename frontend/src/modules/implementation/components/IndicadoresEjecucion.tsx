import { Lock } from 'lucide-react';
import type {
  IndicadorEjecucion,
  ProyectoEjecucion,
} from '../api/projects-api';
import { badgeClass, cardClass } from './ui';

const BLOQUES: { key: keyof Omit<ProyectoEjecucion, 'ouvId' | 'projectId'>; label: string }[] = [
  { key: 'billing', label: 'Facturación' },
  { key: 'costs', label: 'Costos' },
  { key: 'schedule', label: 'Tiempo' },
  { key: 'scope', label: 'Alcance' },
];

function formatPorcentaje(valor: number): string {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(valor)}%`;
}

/**
 * Una desviación positiva no es "buena" ni "mala" por sí sola: en Costos significa
 * sobrecosto y en Facturación, adelanto. Por eso el tono depende del bloque.
 */
function tonoDesviacion(key: string, deviation: number): string {
  if (deviation === 0) return 'bg-border text-muted';
  const desfavorable = key === 'costs' ? deviation > 0 : deviation < 0;
  return desfavorable ? 'bg-danger/15 text-danger' : 'bg-positive/15 text-positive';
}

function Bloque({
  label,
  indicador,
  tono,
}: {
  label: string;
  indicador: IndicadorEjecucion;
  tono: string;
}) {
  return (
    <div className={cardClass}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">{label}</h3>
        <Lock
          size={14}
          className="text-muted"
          aria-label="Calculado por Control de Proyectos"
        />
      </div>

      {indicador.available ? (
        <>
          <p className="text-2xl font-bold text-accent">
            {formatPorcentaje(indicador.percentage)}
          </p>
          <span className={`${badgeClass} mt-2 ${tono}`}>
            Desviación {formatPorcentaje(indicador.deviation)}
          </span>
        </>
      ) : (
        <>
          <p className="text-2xl font-bold text-muted">Sin dato</p>
          <span className={`${badgeClass} mt-2 bg-border text-muted`}>
            Aún no cargado en el PMO
          </span>
        </>
      )}

      <p className="mt-2 text-xs text-muted">
        Fuente: Control de Proyectos · {indicador.source}
      </p>
    </div>
  );
}

/**
 * Los 4 indicadores de ejecución que el PMO calcula. Sólo lectura: el CRM no
 * los almacena ni los recalcula, los muestra tal como los devuelve el PMO.
 */
export function IndicadoresEjecucion({
  proyecto,
}: {
  proyecto: ProyectoEjecucion;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {BLOQUES.map(({ key, label }) => (
        <Bloque
          key={key}
          label={label}
          indicador={proyecto[key]}
          tono={tonoDesviacion(key, proyecto[key].deviation)}
        />
      ))}
    </div>
  );
}
