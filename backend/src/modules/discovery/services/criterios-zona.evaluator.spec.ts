import type { Transaction } from 'sequelize';
import {
  InfluenciaEstado,
  InfluenciaTipo,
  OuvZona,
} from '../models/enums/ouv.enums';
import { CriteriosZonaEvaluator } from './criterios-zona.evaluator';

const transaction = { LOCK: { UPDATE: 'UPDATE' } } as unknown as Transaction;

function evaluatorFor(input: {
  zonaActual: OuvZona;
  presupuestoConfirmado: boolean;
  presupuestoMonto: string | null;
  rows?: { tipo: string; estado: string }[];
}) {
  const locked = {
    ouvId: 'ouv-1',
    consecutivo: 'OUV-0001',
    comercialId: 'user-1',
    zonaActual: input.zonaActual,
    presupuestoConfirmado: input.presupuestoConfirmado,
    presupuestoMonto: input.presupuestoMonto,
    tieneGap: false,
    criteriosFaltantes: null as string[] | null,
    update: jest.fn(async (patch: Record<string, unknown>) => {
      Object.assign(locked, patch);
    }),
  };
  const caller = {
    tieneGap: false,
    criteriosFaltantes: null as string[] | null,
  };
  const influenciaModel = {
    findAll: jest.fn(async () => input.rows ?? []),
  };
  const workflow = { transition: jest.fn() };
  const evaluator = new CriteriosZonaEvaluator(
    { findByPk: jest.fn(async () => locked) } as never,
    influenciaModel as never,
    workflow as never,
  );
  return { evaluator, locked, caller, influenciaModel };
}

async function faltantes(input: {
  zonaActual: OuvZona;
  presupuestoConfirmado?: boolean;
  presupuestoMonto?: string | null;
  rows?: { tipo: string; estado: string }[];
}) {
  const { evaluator, locked, caller, influenciaModel } = evaluatorFor({
    presupuestoConfirmado: false,
    presupuestoMonto: null,
    ...input,
  });
  const zonaAntes = locked.zonaActual;
  await evaluator.evaluate(caller as never, 'user-1', transaction);
  return {
    criterios: locked.criteriosFaltantes,
    zonaActual: locked.zonaActual,
    zonaAntes,
    queriedInfluencias: influenciaModel.findAll.mock.calls.length > 0,
  };
}

const verde = (tipo: InfluenciaTipo) => ({
  tipo,
  estado: InfluenciaEstado.Verde,
});

describe('CriteriosZonaEvaluator.computeFaltantes', () => {
  it('C1: UNIVERSO does not flag presupuesto or influencias', async () => {
    const result = await faltantes({ zonaActual: OuvZona.Universo });
    expect(result.criterios).toBeNull();
    expect(result.queriedInfluencias).toBe(false);
  });

  it('C2: ENCIMA_FUNNEL without presupuesto does not flag it', async () => {
    const result = await faltantes({ zonaActual: OuvZona.EncimaFunnel });
    expect(result.criterios).toBeNull();
  });

  it('C3: EN_FUNNEL without presupuesto flags only that token', async () => {
    const result = await faltantes({ zonaActual: OuvZona.EnFunnel });
    expect(result.criterios).toEqual(['presupuesto_confirmado']);
    expect(result.queriedInfluencias).toBe(false);
  });

  it('C4: EN_FUNNEL with a confirmed amount of 0 flags presupuesto', async () => {
    const result = await faltantes({
      zonaActual: OuvZona.EnFunnel,
      presupuestoConfirmado: true,
      presupuestoMonto: '0.00',
    });
    expect(result.criterios).toEqual(['presupuesto_confirmado']);
  });

  it('C5: EN_FUNNEL with a valid budget and no greens has no gap', async () => {
    const result = await faltantes({
      zonaActual: OuvZona.EnFunnel,
      presupuestoConfirmado: true,
      presupuestoMonto: '1500000.00',
    });
    expect(result.criterios).toBeNull();
  });

  it('C6: MAYOR_PROBABILIDAD flags only influencias when the filter fails', async () => {
    const result = await faltantes({
      zonaActual: OuvZona.MayorProbabilidad,
      presupuestoConfirmado: true,
      presupuestoMonto: '10',
      rows: [verde(InfluenciaTipo.Economica)],
    });
    expect(result.criterios).toEqual(['influencias_verde']);
  });

  it('C7: MAYOR_PROBABILIDAD flags only presupuesto when the filter passes', async () => {
    const result = await faltantes({
      zonaActual: OuvZona.MayorProbabilidad,
      presupuestoConfirmado: false,
      presupuestoMonto: null,
      rows: [verde(InfluenciaTipo.Usuario), verde(InfluenciaTipo.Coach)],
    });
    expect(result.criterios).toEqual(['presupuesto_confirmado']);
  });

  it('C8: MAYOR_PROBABILIDAD lists presupuesto before influencias', async () => {
    const result = await faltantes({
      zonaActual: OuvZona.MayorProbabilidad,
      presupuestoConfirmado: true,
      presupuestoMonto: '0',
      rows: [verde(InfluenciaTipo.Usuario)],
    });
    expect(result.criterios).toEqual([
      'presupuesto_confirmado',
      'influencias_verde',
    ]);
  });

  it('C9: evaluating the gap does not change zona_actual', async () => {
    const cases = [
      OuvZona.Universo,
      OuvZona.EncimaFunnel,
      OuvZona.EnFunnel,
      OuvZona.MayorProbabilidad,
    ];
    for (const zonaActual of cases) {
      const result = await faltantes({ zonaActual });
      expect(result.zonaActual).toBe(result.zonaAntes);
    }
  });
});
