import { presupuestoAvanceDetalle } from '../../../common/presupuesto-avance';
import type { GuardResult, WorkflowGuard } from '../types/workflow.types';

/**
 * Confirmed budget greater than 0 is required only when advancing TO EN_FUNNEL.
 * Any other zona_nueva, including a missing one, is OK.
 * Expects `payload.presupuesto_confirmado` and `payload.presupuesto_monto`.
 */
export const guardPresupuestoConfirmado: WorkflowGuard = (ctx): GuardResult => {
  if (ctx.payload.zona_nueva !== 'EN_FUNNEL') {
    return { ok: true };
  }

  const detalle = presupuestoAvanceDetalle(
    ctx.payload.presupuesto_confirmado,
    ctx.payload.presupuesto_monto,
  );
  if (detalle) {
    return {
      ok: false,
      guard: 'guardPresupuestoConfirmado',
      detalle,
    };
  }

  return { ok: true };
};
