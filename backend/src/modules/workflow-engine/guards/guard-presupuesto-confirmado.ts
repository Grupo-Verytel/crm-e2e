import type { GuardResult, WorkflowGuard } from '../types/workflow.types';

/**
 * Presupuesto confirmado is required when advancing TO ENCIMA_FUNNEL.
 * For other destinations (or events without zona_nueva), always OK.
 * Expects `payload.presupuesto_confirmado` (boolean) from the domain service.
 */
export const guardPresupuestoConfirmado: WorkflowGuard = (ctx): GuardResult => {
  const zonaNueva = ctx.payload.zona_nueva;
  if (zonaNueva && zonaNueva !== 'ENCIMA_FUNNEL') {
    return { ok: true };
  }

  // When zona_nueva is absent, still enforce if the rule included this guard
  // (e.g. explicit presupuesto gate). Avance always sends zona_nueva.
  if (zonaNueva === 'ENCIMA_FUNNEL' || zonaNueva === undefined) {
    if (ctx.payload.presupuesto_confirmado !== true) {
      return {
        ok: false,
        guard: 'guardPresupuestoConfirmado',
        detalle:
          'presupuesto_confirmado debe ser true para avanzar a ENCIMA_FUNNEL',
      };
    }
  }

  return { ok: true };
};
