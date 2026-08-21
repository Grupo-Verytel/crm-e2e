import { EntityType } from '../enums/entity-type.enum';
import type { WorkflowGuardContext } from '../types/workflow.types';
import { guardEntidadEnEstado } from './guard-entidad-en-estado';

function baseCtx(
  overrides: Partial<WorkflowGuardContext> = {},
): WorkflowGuardContext {
  return {
    entityType: EntityType.SQL,
    entityId: 'sql-1',
    entityLabel: 'Acme',
    actorUserId: 'user-1',
    estadoAnterior: 'Asignado',
    estadoNuevo: 'ConvertidoOUV',
    payload: {},
    entity: { estado: 'Asignado' },
    ...overrides,
  };
}

describe('guardEntidadEnEstado', () => {
  it('passes when entityType and estado match (legacy path)', async () => {
    const guard = guardEntidadEnEstado(EntityType.SQL, 'Asignado');
    const result = await guard(baseCtx());
    expect(result).toEqual({ ok: true });
  });

  it('rejects when entityType mismatches (legacy path)', async () => {
    const guard = guardEntidadEnEstado(EntityType.SQL, 'Asignado');
    const result = await guard(baseCtx({ entityType: EntityType.OUV }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.guard).toBe('guardEntidadEnEstado');
      expect(result.detalle).toContain('Se esperaba entidad SQL');
    }
  });

  it('rejects when estado mismatches (legacy path)', async () => {
    const guard = guardEntidadEnEstado(EntityType.SQL, 'PendienteAsignacion');
    const result = await guard(baseCtx());
    expect(result.ok).toBe(false);
  });

  it('with resolver: skips entityType match and uses resolved id', async () => {
    const guard = guardEntidadEnEstado(
      EntityType.SQL,
      'Asignado',
      (ctx) => String(ctx.payload.sqlId ?? ''),
    );
    const result = await guard(
      baseCtx({
        entityType: EntityType.OUV,
        entityId: 'ouv-1',
        payload: { sqlId: 'sql-1' },
        entity: { estado: 'Asignado' },
        estadoAnterior: 'Asignado',
      }),
    );
    expect(result).toEqual({ ok: true });
  });

  it('with resolver: rejects when resolved id is empty', async () => {
    const guard = guardEntidadEnEstado(
      EntityType.SQL,
      'Asignado',
      (ctx) => String(ctx.payload.sqlId ?? ''),
    );
    const result = await guard(
      baseCtx({
        entityType: EntityType.OUV,
        payload: {},
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.detalle).toContain('entityId');
    }
  });
});
