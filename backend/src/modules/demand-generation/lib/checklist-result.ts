import { ChecklistResultado } from '../models/enums/checklist.enums';

export interface ChecklistCriteria {
  criterioSectorObjetivo: boolean;
  criterioNecesidadPortafolio: boolean;
  criterioAccesoDecisor: boolean;
  criterioPresupuestoIndicios: boolean;
}

/** The 4 criteria that must all be true to qualify a lead (DG-13). */
export function allChecklistCriteriaMet(criteria: ChecklistCriteria): boolean {
  return (
    criteria.criterioSectorObjetivo &&
    criteria.criterioNecesidadPortafolio &&
    criteria.criterioAccesoDecisor &&
    criteria.criterioPresupuestoIndicios
  );
}

/**
 * Result is recalculated in the service layer (never in the DB) whenever any
 * of the 4 booleans change — Calificado only when all four are true.
 */
export function computeChecklistResult(
  criteria: ChecklistCriteria,
): ChecklistResultado {
  return allChecklistCriteriaMet(criteria)
    ? ChecklistResultado.Calificado
    : ChecklistResultado.NoCalificado;
}

/** Names of the criteria still pending — used to build explicit error messages. */
export function missingChecklistCriteria(
  criteria: ChecklistCriteria,
): string[] {
  const missing: string[] = [];
  if (!criteria.criterioSectorObjetivo)
    missing.push('criterio_sector_objetivo');
  if (!criteria.criterioNecesidadPortafolio)
    missing.push('criterio_necesidad_portafolio');
  if (!criteria.criterioAccesoDecisor) missing.push('criterio_acceso_decisor');
  if (!criteria.criterioPresupuestoIndicios)
    missing.push('criterio_presupuesto_indicios');
  return missing;
}
