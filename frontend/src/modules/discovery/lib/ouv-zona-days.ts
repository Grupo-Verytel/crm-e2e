import type { Ouv } from '../api/ouvs-api';
import type { OuvZona } from './ouv-vocab';

const MS_PER_DAY = 86_400_000;

/** Days spent in a funnel zone. Prefers API `dias_por_zona`; falls back to current zone. */
export function daysInOuvZona(
  ouv: Ouv,
  zona: OuvZona,
  now = Date.now(),
): number {
  if (ouv.dias_por_zona) {
    return ouv.dias_por_zona[zona] ?? 0;
  }
  if (zona !== ouv.zona_actual) return 0;
  const start = new Date(ouv.created_at).getTime();
  const closed = ouv.resultado !== 'EnCurso';
  const end = closed
    ? new Date(ouv.fecha_cierre ?? ouv.updated_at).getTime()
    : now;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return 0;
  }
  return Math.floor((end - start) / MS_PER_DAY);
}
