import { InfluenciaEstado, InfluenciaTipo } from '../models/enums/ouv.enums';

export const INFLUENCE_FILTER_REQUIRED = 2 as const;

const FILTER_TYPES = new Set<string>([
  InfluenciaTipo.Economica,
  InfluenciaTipo.Tecnica,
  InfluenciaTipo.Fabrica,
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
 * A type counts when it is Economica, Tecnica or Fabrica and has at least
 * one contact in Verde. Usuario and Coach never count. Rojo does not cancel Verde.
 */
export function evaluateInfluenceFilter(
  influences: InfluenceFilterInput[],
): InfluenceFilterResult {
  const green = new Set<string>();
  for (const row of influences) {
    if (
      row.estado === InfluenciaEstado.Verde &&
      FILTER_TYPES.has(row.tipo)
    ) {
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
};

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
  return `Se requieren ${result.required} tipos de influencia en Verde (Económica, Técnica, Fábrica). Actualmente: ${actual}.`;
}
