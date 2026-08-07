import type { GuardResult, WorkflowGuard } from '../types/workflow.types';

/**
 * Actor must be the Ejecutivo Comercial assigned to the SQL of origin.
 * Expects `payload.comercial_asignado_id` (sqls.comercial_asignado_id).
 */
export const guardUsuarioEsComercialDelSQL: WorkflowGuard = (
  ctx,
): GuardResult => {
  const comercialId = ctx.payload.comercial_asignado_id;
  if (typeof comercialId !== 'string' || !comercialId) {
    return {
      ok: false,
      guard: 'guardUsuarioEsComercialDelSQL',
      detalle: 'payload.comercial_asignado_id is required',
    };
  }

  if (ctx.actorUserId !== comercialId) {
    return {
      ok: false,
      guard: 'guardUsuarioEsComercialDelSQL',
      detalle: 'Solo el comercial asignado al SQL puede realizar esta acción',
    };
  }

  return { ok: true };
};
