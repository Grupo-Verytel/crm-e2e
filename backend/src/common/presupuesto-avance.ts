/**
 * Budget gate for ENCIMA_FUNNEL → EN_FUNNEL.
 * Sequelize DECIMAL(18,2) arrives as a string. null and undefined count as 0.
 */

export const PRESUPUESTO_AVANCE_CONFIRMADO =
  'El presupuesto debe estar confirmado para avanzar a En Funnel.';

export const PRESUPUESTO_AVANCE_MONTO =
  'El presupuesto debe ser mayor a 0 para avanzar a En Funnel.';

export function presupuestoMontoAvance(monto: unknown): number {
  if (monto === null || monto === undefined) return 0;
  const value = typeof monto === 'number' ? monto : Number(monto);
  return Number.isFinite(value) ? value : 0;
}

/** Phrases for the failed conditions, boolean first. Empty when the gate passes. */
export function presupuestoAvanceFrases(
  confirmado: unknown,
  monto: unknown,
): string[] {
  const frases: string[] = [];
  if (confirmado !== true) frases.push(PRESUPUESTO_AVANCE_CONFIRMADO);
  if (!(presupuestoMontoAvance(monto) > 0))
    frases.push(PRESUPUESTO_AVANCE_MONTO);
  return frases;
}

export function presupuestoAvanceCumple(
  confirmado: unknown,
  monto: unknown,
): boolean {
  return presupuestoAvanceFrases(confirmado, monto).length === 0;
}

export function presupuestoAvanceDetalle(
  confirmado: unknown,
  monto: unknown,
): string | null {
  const frases = presupuestoAvanceFrases(confirmado, monto);
  return frases.length > 0 ? frases.join(' ') : null;
}
