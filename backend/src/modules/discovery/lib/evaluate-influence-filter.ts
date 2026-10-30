import { InfluenciaEstado, InfluenciaTipo } from '../models/enums/ouv.enums';

export const INFLUENCE_FILTER_REQUIRED = 2 as const;

const FILTER_TYPES = new Set<string>([
  InfluenciaTipo.Economica,
  InfluenciaTipo.Tecnica,
  InfluenciaTipo.Fabrica,
  InfluenciaTipo.Usuario,
  InfluenciaTipo.Coach,
]);

export type InfluenceFilterInput = {
  tipo: string;
  estado: string;
};

export type InfluenceFilterResult = {
  passed: boolean;
  greenTypes: string[];
  required: typeof INFLUENCE_FILTER_REQUIRED;
};

/**
 * A type counts when it is Economica, Tecnica, Fabrica, Usuario or Coach
 * and the row is Verde. Distinct types only. Rojo does not cancel Verde.
 */
export function evaluateInfluenceFilter(
  influences: InfluenceFilterInput[],
): InfluenceFilterResult {
  const green = new Set<string>();
  for (const row of influences) {
    if (row.estado === InfluenciaEstado.Verde && FILTER_TYPES.has(row.tipo)) {
      green.add(row.tipo);
    }
  }
  const greenTypes = [...green];
  return {
    passed: greenTypes.length >= INFLUENCE_FILTER_REQUIRED,
    greenTypes,
    required: INFLUENCE_FILTER_REQUIRED,
  };
}

const FILTER_TYPE_LABEL: Record<string, string> = {
  [InfluenciaTipo.Economica]: 'Económica',
  [InfluenciaTipo.Tecnica]: 'Técnica',
  [InfluenciaTipo.Fabrica]: 'Fábrica',
  [InfluenciaTipo.Usuario]: 'Usuario',
  [InfluenciaTipo.Coach]: 'Coach',
};

const FILTER_TYPE_LIST = 'Económica, Técnica, Fábrica, Usuario, Coach';

export function influenceFilterBlockDetail(
  result: InfluenceFilterResult,
): string {
  const names = result.greenTypes.map(
    (tipo) => FILTER_TYPE_LABEL[tipo] ?? tipo,
  );
  const actual =
    names.length > 0
      ? `${result.greenTypes.length} (${names.join(', ')})`
      : String(result.greenTypes.length);
  return `Se requieren ${result.required} tipos de influencia en Verde (${FILTER_TYPE_LIST}). Actualmente: ${actual}.`;
}
