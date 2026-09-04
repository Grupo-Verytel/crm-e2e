import { OuvResultado, OuvZona } from '../models/enums/ouv.enums';
import { OUV_ZONA_ORDER } from './ouv-zona-order';

const MS_PER_DAY = 86_400_000;

export type ZonaTransition = {
  at: Date;
  to: OuvZona;
};

export type OuvZonaDaysInput = {
  createdAt: Date;
  zonaActual: OuvZona;
  resultado: OuvResultado;
  fechaCierre: Date | null;
  now: Date;
  transitions: ZonaTransition[];
};

export type OuvDiasPorZona = Record<OuvZona, number>;

export function emptyDiasPorZona(): OuvDiasPorZona {
  return {
    [OuvZona.Universo]: 0,
    [OuvZona.EncimaFunnel]: 0,
    [OuvZona.EnFunnel]: 0,
    [OuvZona.MayorProbabilidad]: 0,
  };
}

const ZONA_VALUES = new Set<string>(OUV_ZONA_ORDER);

export function parseZonaValue(raw: string | null | undefined): OuvZona | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'string' && ZONA_VALUES.has(parsed)) {
      return parsed as OuvZona;
    }
  } catch {
    /* raw ENUM string */
  }
  if (ZONA_VALUES.has(raw)) return raw as OuvZona;
  return null;
}

function isClosed(resultado: OuvResultado): boolean {
  return resultado !== OuvResultado.EnCurso;
}

/**
 * Days spent in each funnel zone.
 * Mayor Probabilidad (and any zone the OUV closes from) stops at
 * Ganada / Perdida / Descartada (`fechaCierre`).
 */
export function computeOuvZonaDays(input: OuvZonaDaysInput): OuvDiasPorZona {
  const ms: Record<OuvZona, number> = {
    [OuvZona.Universo]: 0,
    [OuvZona.EncimaFunnel]: 0,
    [OuvZona.EnFunnel]: 0,
    [OuvZona.MayorProbabilidad]: 0,
  };

  const end = isClosed(input.resultado)
    ? (input.fechaCierre ?? input.now)
    : input.now;

  const transitions = [...input.transitions]
    .filter((t) => Number.isFinite(t.at.getTime()))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  let cursor = input.createdAt;
  let zona =
    transitions.length === 0 ? input.zonaActual : OuvZona.Universo;

  for (const t of transitions) {
    if (t.at.getTime() > end.getTime()) break;
    const at =
      t.at.getTime() < cursor.getTime() ? cursor : t.at;
    ms[zona] += Math.max(0, at.getTime() - cursor.getTime());
    cursor = at;
    zona = t.to;
  }

  ms[zona] += Math.max(0, end.getTime() - cursor.getTime());

  const days = emptyDiasPorZona();
  for (const z of OUV_ZONA_ORDER) {
    days[z] = Math.floor(ms[z] / MS_PER_DAY);
  }
  return days;
}
