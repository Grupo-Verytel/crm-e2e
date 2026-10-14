import type { GuardResult, WorkflowGuard } from '../types/workflow.types';

const GREEN_REQUIRED = 2;

/**
 * Confirmed budget greater than 0. Used only by `ouv.ganada`.
 * Expects `payload.presupuesto_confirmado` and `payload.presupuesto_monto`.
 */
export const guardPresupuestoGanada: WorkflowGuard = (ctx): GuardResult => {
  const monto = Number(ctx.payload.presupuesto_monto);
  if (
    ctx.payload.presupuesto_confirmado !== true ||
    !Number.isFinite(monto) ||
    monto <= 0
  ) {
    return {
      ok: false,
      guard: 'guardPresupuestoGanada',
      detalle:
        'El presupuesto debe estar confirmado y ser mayor a 0 para cerrar la OUV como Ganada.',
    };
  }
  return { ok: true };
};

/**
 * At least two distinct influence types in Verde among Económica, Técnica,
 * Fábrica, Usuario and Coach. The domain service counts the types.
 * Expects `payload.influencias_verde_count`.
 */
export const guardInfluenciasGanada: WorkflowGuard = (ctx): GuardResult => {
  const count = Number(ctx.payload.influencias_verde_count ?? NaN);
  if (!Number.isFinite(count) || count < GREEN_REQUIRED) {
    return {
      ok: false,
      guard: 'guardInfluenciasGanada',
      detalle: `Se requieren al menos ${GREEN_REQUIRED} tipos de influencia en Verde (Económica, Técnica, Fábrica, Usuario, Coach). Actualmente: ${Number.isFinite(count) ? count : 0}.`,
    };
  }
  return { ok: true };
};
