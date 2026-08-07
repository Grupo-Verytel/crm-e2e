import type { GuardResult, WorkflowGuard } from '../types/workflow.types';

/**
 * Actor must be the Ejecutivo Comercial that owns the OUV.
 * Expects `payload.comercial_id` (ouvs.comercial_id).
 */
export const guardUsuarioEsComercialDelOUV: WorkflowGuard = (
  ctx,
): GuardResult => {
  const comercialId = ctx.payload.comercial_id;
  if (typeof comercialId !== 'string' || !comercialId) {
    return {
      ok: false,
      guard: 'guardUsuarioEsComercialDelOUV',
      detalle: 'payload.comercial_id is required',
    };
  }

  if (ctx.actorUserId !== comercialId) {
    return {
      ok: false,
      guard: 'guardUsuarioEsComercialDelOUV',
      detalle: 'Solo el comercial dueño de la OUV puede realizar esta acción',
    };
  }

  return { ok: true };
};
