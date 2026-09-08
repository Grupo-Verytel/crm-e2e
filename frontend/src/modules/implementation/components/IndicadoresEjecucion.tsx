import { Lock } from 'lucide-react';
import type {
  IndicadorAlcance,
  IndicadorEjecucion,
  ProyectoEjecucion,
} from '../api/projects-api';
import { badgeClass, cardClass } from './ui';

type BloqueKey = 'billing' | 'costs' | 'schedule' | 'scope';

const BLOQUES: { key: BloqueKey; label: string }[] = [
  { key: 'billing', label: 'Facturación' },
  { key: 'costs', label: 'Costos' },
  { key: 'schedule', label: 'Tiempo' },
  { key: 'scope', label: 'Alcance' },
];

/** El signo solo aporta en la desviación; en el avance sobra. */
function formatPorcentaje(valor: number, conSigno = false): string {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: conSigno ? 'exceptZero' : 'auto',
  }).format(valor)}%`;
}

function formatPesos(valor: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(valor);
}

function formatFecha(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime())
    ? iso
    : fecha.toLocaleDateString('es-CO');
}

/**
 * Margen dentro del cual un proyecto se considera en plan. Sin él, un
 * sobrecosto del 0,8% se pintaba tan rojo como un desfase del 12%, y el
 * tablero se leía como una emergencia aunque todo fuera bien.
 */
const TOLERANCIA_PCT = 5;

/**
 * Una desviación positiva no es "buena" ni "mala" por sí sola: en Costos
 * significa sobrecosto y en Facturación, adelanto. Por eso el tono depende del
 * bloque, y solo se enciende cuando la desviación supera la tolerancia.
 */
function tonoDesviacion(key: BloqueKey, deviation: number): string {
  if (Math.abs(deviation) <= TOLERANCIA_PCT) return 'bg-border text-muted';
  const desfavorable = key === 'costs' ? deviation > 0 : deviation < 0;
  return desfavorable
    ? 'bg-danger/15 text-danger'
    : 'bg-positive/15 text-positive';
}

/**
 * Cifra principal de cada tarjeta, en la unidad que le es propia: pesos
 * facturados, semana del cronograma, entregables cerrados. El porcentaje solo
 * queda como respaldo cuando el PMO no envía el agregado.
 */
function valorPrincipal(
  key: BloqueKey,
  indicador: IndicadorEjecucion | IndicadorAlcance,
): string {
  const resumen = indicador.summary;

  if (key === 'scope') {
    const alcance = resumen as IndicadorAlcance['summary'];
    if (alcance && alcance.total > 0) {
      return `${alcance.completed}/${alcance.total} entregables`;
    }
    return formatPorcentaje(indicador.percentage);
  }

  const serie = resumen as IndicadorEjecucion['summary'];
  if (key === 'billing' && serie && serie.actualTotal > 0) {
    return formatPesos(serie.actualTotal);
  }
  if (key === 'schedule' && serie?.lastWeek != null && serie.totalWeeks > 0) {
    return `Semana ${serie.lastWeek}/${serie.totalWeeks}`;
  }
  return formatPorcentaje(indicador.percentage);
}

function fechaCorte(
  indicador: IndicadorEjecucion | IndicadorAlcance,
): string | null {
  const resumen = indicador.summary as IndicadorEjecucion['summary'];
  return resumen?.lastDate ?? null;
}

function Bloque({
  bloqueKey,
  label,
  indicador,
}: {
  bloqueKey: BloqueKey;
  label: string;
  indicador: IndicadorEjecucion | IndicadorAlcance;
}) {
  const corte = fechaCorte(indicador);

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
            {valorPrincipal(bloqueKey, indicador)}
          </p>
          <span
            className={`${badgeClass} mt-2 ${tonoDesviacion(
              bloqueKey,
              indicador.deviation,
            )}`}
          >
            Desviación {formatPorcentaje(indicador.deviation, true)}
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

      {corte ? (
        <p className="mt-2 text-xs text-muted">
          Actualizado: {formatFecha(corte)}
        </p>
      ) : null}

      <p className="mt-1 text-xs text-muted">
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
          bloqueKey={key}
          label={label}
          indicador={proyecto[key]}
        />
      ))}
    </div>
  );
}
