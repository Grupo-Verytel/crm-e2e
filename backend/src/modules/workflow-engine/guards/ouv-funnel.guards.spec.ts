import { guardPresupuestoConfirmado } from './guard-presupuesto-confirmado';
import { guard2InfluenciasEnVerde } from './guard-2-influencias-en-verde';
import {
  guardInfluenciasGanada,
  guardPresupuestoGanada,
} from './guard-cierre-ganada';
import { guardUsuarioEsComercialDelOUV } from './guard-usuario-es-comercial-del-ouv';
import { EntityType } from '../enums/entity-type.enum';
import type { WorkflowGuardContext } from '../types/workflow.types';

function baseCtx(
  overrides: Partial<WorkflowGuardContext> = {},
): WorkflowGuardContext {
  return {
    entityType: EntityType.OUV,
    entityId: 'ouv-1',
    entityLabel: 'OUV-0001',
    actorUserId: 'user-1',
    estadoAnterior: 'UNIVERSO',
    estadoNuevo: 'ENCIMA_FUNNEL',
    payload: {},
    entity: { estado: 'UNIVERSO' },
    ...overrides,
  };
}

describe('guardPresupuestoConfirmado', () => {
  const confirmado =
    'El presupuesto debe estar confirmado para avanzar a En Funnel.';
  const monto = 'El presupuesto debe ser mayor a 0 para avanzar a En Funnel.';

  it('G1: allows a missing zona_nueva without presupuesto', async () => {
    const result = await guardPresupuestoConfirmado(
      baseCtx({ payload: { presupuesto_confirmado: false } }),
    );
    expect(result.ok).toBe(true);
  });

  it('G2: allows ENCIMA_FUNNEL without presupuesto', async () => {
    const result = await guardPresupuestoConfirmado(
      baseCtx({
        payload: { zona_nueva: 'ENCIMA_FUNNEL', presupuesto_confirmado: false },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('G3: rejects EN_FUNNEL when the confirmed amount is 0', async () => {
    const result = await guardPresupuestoConfirmado(
      baseCtx({
        payload: {
          zona_nueva: 'EN_FUNNEL',
          presupuesto_confirmado: true,
          presupuesto_monto: 0,
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.guard).toBe('guardPresupuestoConfirmado');
      expect(result.detalle).toBe(monto);
    }
  });

  it('G4: allows EN_FUNNEL with a confirmed amount above 0', async () => {
    const result = await guardPresupuestoConfirmado(
      baseCtx({
        payload: {
          zona_nueva: 'EN_FUNNEL',
          presupuesto_confirmado: true,
          presupuesto_monto: 1,
        },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects the decimal string 0.00 and allows 1500000.00', async () => {
    const rejected = await guardPresupuestoConfirmado(
      baseCtx({
        payload: {
          zona_nueva: 'EN_FUNNEL',
          presupuesto_confirmado: true,
          presupuesto_monto: '0.00',
        },
      }),
    );
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.detalle).toBe(monto);

    const allowed = await guardPresupuestoConfirmado(
      baseCtx({
        payload: {
          zona_nueva: 'EN_FUNNEL',
          presupuesto_confirmado: true,
          presupuesto_monto: '1500000.00',
        },
      }),
    );
    expect(allowed.ok).toBe(true);
  });

  it('names both phrases when the flag is false and the amount is null', async () => {
    const result = await guardPresupuestoConfirmado(
      baseCtx({
        payload: {
          zona_nueva: 'EN_FUNNEL',
          presupuesto_confirmado: false,
          presupuesto_monto: null,
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detalle).toBe(`${confirmado} ${monto}`);
  });
});

describe('guard2InfluenciasEnVerde', () => {
  it('G5: allows EN_FUNNEL with a zero verde count', async () => {
    const result = await guard2InfluenciasEnVerde(
      baseCtx({
        payload: { zona_nueva: 'EN_FUNNEL', influencias_verde_count: 0 },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('G6: rejects MAYOR_PROBABILIDAD with fewer than 2 verdes', async () => {
    const result = await guard2InfluenciasEnVerde(
      baseCtx({
        payload: {
          zona_nueva: 'MAYOR_PROBABILIDAD',
          influencias_verde_count: 1,
        },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('G7: allows MAYOR_PROBABILIDAD with 2 verdes', async () => {
    const result = await guard2InfluenciasEnVerde(
      baseCtx({
        payload: {
          zona_nueva: 'MAYOR_PROBABILIDAD',
          influencias_verde_count: 2,
        },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('G8: rejects an empty zona_nueva when the verde count is 0', async () => {
    const result = await guard2InfluenciasEnVerde(
      baseCtx({
        payload: { zona_nueva: '', influencias_verde_count: 0 },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.detalle).toMatch(/tipos en Verde/);
    }
  });
});

describe('guardCierreGanada', () => {
  it('rejects an unconfirmed budget', async () => {
    const result = await guardPresupuestoGanada(
      baseCtx({
        payload: { presupuesto_confirmado: false, presupuesto_monto: 100 },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a confirmed budget of 0', async () => {
    const result = await guardPresupuestoGanada(
      baseCtx({
        payload: { presupuesto_confirmado: true, presupuesto_monto: 0 },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('allows a confirmed budget above 0 from Universo', async () => {
    const result = await guardPresupuestoGanada(
      baseCtx({
        estadoAnterior: 'UNIVERSO',
        payload: { presupuesto_confirmado: true, presupuesto_monto: 1 },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects fewer than 2 green influence types', async () => {
    const result = await guardInfluenciasGanada(
      baseCtx({ payload: { influencias_verde_count: 1 } }),
    );
    expect(result.ok).toBe(false);
  });

  it('allows 2 green influence types', async () => {
    const result = await guardInfluenciasGanada(
      baseCtx({ payload: { influencias_verde_count: 2 } }),
    );
    expect(result.ok).toBe(true);
  });
});

describe('guardUsuarioEsComercialDelOUV', () => {
  it('rejects when comercial_id missing', async () => {
    const result = await guardUsuarioEsComercialDelOUV(baseCtx());
    expect(result.ok).toBe(false);
  });

  it('rejects when actor is not owner', async () => {
    const result = await guardUsuarioEsComercialDelOUV(
      baseCtx({
        actorUserId: 'user-1',
        payload: { comercial_id: 'user-2' },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('allows owner', async () => {
    const result = await guardUsuarioEsComercialDelOUV(
      baseCtx({
        actorUserId: 'user-1',
        payload: { comercial_id: 'user-1' },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('allows Admin when not owner', async () => {
    const result = await guardUsuarioEsComercialDelOUV(
      baseCtx({
        actorUserId: 'admin-1',
        payload: { comercial_id: 'user-2' },
        usersService: {
          isActiveWithRole: async (userId: string, role: string) =>
            userId === 'admin-1' && role === 'Admin',
        } as WorkflowGuardContext['usersService'],
      }),
    );
    expect(result.ok).toBe(true);
  });
});
