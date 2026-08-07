import type { GuardResult, WorkflowGuard } from '../types/workflow.types';

const ZONAS_REQUIEREN_VERDE = new Set(['EN_FUNNEL', 'MAYOR_PROBABILIDAD']);

/**
 * At least 2 influencias in Verde — required when advancing TO EN_FUNNEL
 * or MAYOR_PROBABILIDAD. Expects `payload.influencias_verde_count` (number)
 * computed by the domain service under row lock (Fase A: no DI query in guards).
 */
export const guard2InfluenciasEnVerde: WorkflowGuard = (ctx): GuardResult => {
  const zonaNueva = ctx.payload.zona_nueva;
  if (
    typeof zonaNueva === 'string' &&
    zonaNueva.length > 0 &&
    !ZONAS_REQUIEREN_VERDE.has(zonaNueva)
  ) {
    return { ok: true };
  }

  const count = Number(ctx.payload.influencias_verde_count ?? NaN);
  if (!Number.isFinite(count) || count < 2) {
    return {
      ok: false,
      guard: 'guard2InfluenciasEnVerde',
      detalle: `Se requieren al menos 2 influencias en Verde (hay ${Number.isFinite(count) ? count : 0})`,
    };
  }

  return { ok: true };
};
