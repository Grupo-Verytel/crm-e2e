import type { GuardResult, WorkflowGuard } from '../types/workflow.types';

/**
 * Factory: actor (`ctx.actorUserId`) must be an active user with the given role name.
 * Relies on `UsersService.isActiveWithRole` injected on the guard context by the engine.
 */
export function guardUsuarioTieneRol(rol: string): WorkflowGuard {
  return async (ctx): Promise<GuardResult> => {
    const usersService = ctx.usersService;
    if (!usersService) {
      return {
        ok: false,
        guard: 'guardUsuarioTieneRol',
        detalle: 'UsersService is not available on the workflow guard context',
      };
    }

    if (!ctx.actorUserId) {
      return {
        ok: false,
        guard: 'guardUsuarioTieneRol',
        detalle: `Se requiere actor con rol ${rol}`,
      };
    }

    const allowed = await usersService.isActiveWithRole(ctx.actorUserId, rol);
    if (!allowed) {
      return {
        ok: false,
        guard: 'guardUsuarioTieneRol',
        detalle: `Usuario debe tener rol ${rol}`,
      };
    }

    return { ok: true };
  };
}
