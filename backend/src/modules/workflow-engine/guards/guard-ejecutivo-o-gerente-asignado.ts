import {
  EJECUTIVO_COMERCIAL_ROLE_NAME,
  GERENTE_COMERCIAL_ROLE_NAME,
} from '../../auth/constants/commercial-roles';
import type { GuardResult, WorkflowGuard } from '../types/workflow.types';

/**
 * Active EjecutivoComercial passes as before.
 * Active Gerente Comercial passes only when `actorUserId` is the assigned
 * commercial in `payload[comercialPayloadKey]`.
 */
export function guardEjecutivoOGerenteAsignado(
  comercialPayloadKey: 'comercial_id' | 'comercial_asignado_id',
): WorkflowGuard {
  return async (ctx): Promise<GuardResult> => {
    const usersService = ctx.usersService;
    if (!usersService || !ctx.actorUserId) {
      return {
        ok: false,
        guard: 'guardEjecutivoOGerenteAsignado',
        detalle: 'Se requiere un actor comercial activo',
      };
    }

    const isEjecutivo = await usersService.isActiveWithRole(
      ctx.actorUserId,
      EJECUTIVO_COMERCIAL_ROLE_NAME,
    );
    if (isEjecutivo) {
      return { ok: true };
    }

    const isGerente = await usersService.isActiveWithRole(
      ctx.actorUserId,
      GERENTE_COMERCIAL_ROLE_NAME,
    );
    if (!isGerente) {
      return {
        ok: false,
        guard: 'guardEjecutivoOGerenteAsignado',
        detalle: `Usuario debe tener rol ${EJECUTIVO_COMERCIAL_ROLE_NAME} o ${GERENTE_COMERCIAL_ROLE_NAME}`,
      };
    }

    const comercialId = ctx.payload[comercialPayloadKey];
    if (typeof comercialId === 'string' && comercialId === ctx.actorUserId) {
      return { ok: true };
    }

    return {
      ok: false,
      guard: 'guardEjecutivoOGerenteAsignado',
      detalle: `${GERENTE_COMERCIAL_ROLE_NAME} solo puede actuar sobre la OUV o el SQL que tiene asignados`,
    };
  };
}
