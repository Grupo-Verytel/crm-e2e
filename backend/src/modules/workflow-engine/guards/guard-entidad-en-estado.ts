import type { EntityType } from '../enums/entity-type.enum';
import type {
  GuardResult,
  WorkflowGuard,
  WorkflowGuardContext,
} from '../types/workflow.types';

/**
 * Factory: entity must currently be in `estadoEsperado` (state being left).
 * Uses `ctx.entity.estado` when present, otherwise `ctx.estadoAnterior`.
 *
 * Optional `entityIdResolver`: when provided, validates a *related* entity
 * (e.g. SQL origin while transitioning an OUV). Skips the
 * `ctx.entityType === entityType` check; requires a non-empty resolved id;
 * still validates estado from `ctx.entity` / `ctx.estadoAnterior` (caller
 * must pass the related entity's estado). Without resolver, behavior is
 * identical to the original guard.
 */
export function guardEntidadEnEstado(
  entityType: EntityType | `${EntityType}`,
  estadoEsperado: string,
  entityIdResolver?: (ctx: WorkflowGuardContext) => string,
): WorkflowGuard {
  return (ctx): GuardResult => {
    if (entityIdResolver) {
      const resolvedId = entityIdResolver(ctx);
      if (!resolvedId) {
        return {
          ok: false,
          guard: 'guardEntidadEnEstado',
          detalle: `Se requiere entityId de ${entityType}`,
        };
      }
    } else if (ctx.entityType !== entityType) {
      return {
        ok: false,
        guard: 'guardEntidadEnEstado',
        detalle: `Se esperaba entidad ${entityType}, se recibió ${ctx.entityType}`,
      };
    }

    const actual = ctx.entity?.estado ?? ctx.estadoAnterior;
    if (actual !== estadoEsperado) {
      return {
        ok: false,
        guard: 'guardEntidadEnEstado',
        detalle: `${entityType} debe estar en estado ${estadoEsperado}, está en ${actual ?? 'null'}`,
      };
    }

    return { ok: true };
  };
}
