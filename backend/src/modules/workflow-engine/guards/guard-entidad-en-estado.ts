import type { EntityType } from '../enums/entity-type.enum';
import type { GuardResult, WorkflowGuard } from '../types/workflow.types';

/**
 * Factory: entity must currently be in `estadoEsperado` (state being left).
 * Uses `ctx.entity.estado` when present, otherwise `ctx.estadoAnterior`.
 */
export function guardEntidadEnEstado(
  entityType: EntityType | `${EntityType}`,
  estadoEsperado: string,
): WorkflowGuard {
  return (ctx): GuardResult => {
    if (ctx.entityType !== entityType) {
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
