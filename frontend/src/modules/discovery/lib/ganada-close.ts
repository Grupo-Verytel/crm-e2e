import type { Ouv, OuvInfluencia } from '../api/ouvs-api';
import {
  INFLUENCIA_TIPO_LABEL,
  INFLUENCIA_TIPOS,
  type InfluenciaTipo,
} from './ouv-vocab';

const GANADA_TYPES = new Set<string>(INFLUENCIA_TIPOS);
const GANADA_GREEN_REQUIRED = 2;

export function greenInfluenceTypesForGanada(
  influencias: OuvInfluencia[],
): InfluenciaTipo[] {
  const green = new Set<string>();
  for (const row of influencias) {
    if (row.estado === 'Verde' && GANADA_TYPES.has(row.tipo)) {
      green.add(row.tipo);
    }
  }
  return INFLUENCIA_TIPOS.filter((tipo) => green.has(tipo));
}

export function ganadaCloseBlockers(
  ouv: Ouv,
  influencias: OuvInfluencia[],
): string[] {
  const blockers: string[] = [];
  const raw = ouv.presupuesto_monto;
  const monto = raw === null || raw === '' ? NaN : Number(raw);
  if (!ouv.presupuesto_confirmado || !Number.isFinite(monto) || monto <= 0) {
    blockers.push('Confirma un presupuesto mayor a 0.');
  }
  const greens = greenInfluenceTypesForGanada(influencias);
  if (greens.length < GANADA_GREEN_REQUIRED) {
    const names = greens.map((tipo) => INFLUENCIA_TIPO_LABEL[tipo]);
    const actual =
      names.length > 0 ? `${greens.length} (${names.join(', ')})` : '0';
    blockers.push(
      `Marca al menos 2 tipos de influencia en Verde (Económica, Técnica, Fábrica, Usuario, Coach). Hay ${actual}.`,
    );
  }
  return blockers;
}
