import { BadRequestException, HttpStatus } from '@nestjs/common';
import { InfluenciaProblemException } from '../exceptions/influencia-problem.exception';
import { OuvZona } from '../models/enums/ouv.enums';
import { OuvsService } from './ouvs.service';

const transaction = { LOCK: { UPDATE: 'UPDATE' } };

function serviceWith(overrides: {
  influencias?: Record<string, unknown>;
  demand?: Record<string, unknown>;
  accounts?: Record<string, unknown>;
  contactos?: Record<string, unknown>;
}) {
  const sequelize = {
    transaction: async (fn: (t: typeof transaction) => Promise<unknown>) =>
      fn(transaction),
    query: async () => [{ siguiente: 1 }],
  };
  const ouv = {
    ouvId: 'ouv-nueva',
    consecutivo: 'OUV-0001',
    titulo: 'Titulo',
    empresaNombre: 'Empresa',
    accountId: null,
    getDataValue: () => 'ouv-nueva',
  };
  const seed = jest.fn();
  const influencias = {
    seedInfluenciasParaOuv: seed,
    filtroForOuv: jest.fn(),
    countGreenTypes: jest.fn(),
    ...overrides.influencias,
  };
  const checklist = { seedChecklistParaZona: jest.fn() };
  const workflow = { transition: jest.fn() };
  const service = new OuvsService(
    sequelize as never,
    { create: jest.fn(async () => ouv) } as never,
    {} as never,
    {} as never,
    {} as never,
    {
      findLeadById: jest.fn(),
      assertSegmentSubsegment: jest.fn(),
      ...overrides.demand,
    } as never,
    {
      getPeopleWithAccounts: jest.fn(),
      getAccount: jest.fn(),
      ...overrides.accounts,
    } as never,
    {} as never,
    { reutilizarDesdeLead: jest.fn(), ...overrides.contactos } as never,
    influencias as never,
    checklist as never,
    {} as never,
    {} as never,
    workflow as never,
    {} as never,
  );
  return { service, seed, checklist, workflow };
}

describe('OUV creation does not insert influencia rows', () => {
  it('creates a direct OUV without calling the influencia seed', async () => {
    const { service, seed, checklist, workflow } = serviceWith({});
    const ouv = await service.crearDirecta(
      {
        titulo: 'Titulo',
        empresa_nombre: 'Empresa',
        descripcion: 'Desc',
        segmento: 'Industria',
        vertical: 'Otros',
      } as never,
      'user-1',
    );
    expect(ouv.ouvId).toBe('ouv-nueva');
    expect(seed).not.toHaveBeenCalled();
    expect(checklist.seedChecklistParaZona).toHaveBeenCalled();
    expect(workflow.transition).toHaveBeenCalled();
  });

  it('creates an OUV from SQL without calling the influencia seed', async () => {
    const { service, seed } = serviceWith({
      demand: {
        findLeadById: jest.fn(async () => ({
          account_id: 'acc-1',
          city: 'Bogota',
          region: 'Andina',
          origen: null,
          canal_origen: null,
          contacts: [{ position: 1, person_id: 'person-1' }],
        })),
        assertSegmentSubsegment: jest.fn(),
      },
      accounts: {
        getPeopleWithAccounts: jest.fn(
          async () =>
            new Map([
              ['person-1', { account_id: 'acc-1', account_name: 'Empresa' }],
            ]),
        ),
      },
    });
    const ouv = await service.crearDesdeSql(
      {
        sqlId: 'sql-1',
        comercialId: 'user-1',
        leadId: 'lead-1',
        dto: {
          titulo: 'Titulo',
          descripcion: 'Desc',
          segmento: 'Industria',
          segment_id: 'seg-1',
          vertical: 'Otros',
        },
      } as never,
      transaction as never,
    );
    expect(ouv.ouvId).toBe('ouv-nueva');
    expect(seed).not.toHaveBeenCalled();
  });
});

describe('assertGuardsForDestino zone rules', () => {
  const confirmado =
    'El presupuesto debe estar confirmado para avanzar a En Funnel.';
  const monto = 'El presupuesto debe ser mayor a 0 para avanzar a En Funnel.';

  function ouv(partial: {
    zonaActual?: OuvZona;
    presupuestoConfirmado?: boolean;
    presupuestoMonto?: string | null;
  }) {
    return {
      zonaActual: partial.zonaActual ?? OuvZona.EncimaFunnel,
      presupuestoConfirmado: partial.presupuestoConfirmado ?? false,
      presupuestoMonto: partial.presupuestoMonto ?? null,
    } as never;
  }

  async function assertDestino(
    destino: OuvZona,
    row: ReturnType<typeof ouv>,
    influencias?: Record<string, unknown>,
  ) {
    const filtroForOuv =
      (influencias?.filtroForOuv as jest.Mock | undefined) ?? jest.fn();
    const { service } = serviceWith({
      influencias: { ...influencias, filtroForOuv },
    });
    await service['assertGuardsForDestino'](row, destino, transaction as never);
    return filtroForOuv;
  }

  async function rejectDestino(
    destino: OuvZona,
    row: ReturnType<typeof ouv>,
    influencias?: Record<string, unknown>,
  ) {
    const { service } = serviceWith({ influencias });
    return service['assertGuardsForDestino'](
      row,
      destino,
      transaction as never,
    );
  }

  it('A1 A2 A3: UNIVERSO to ENCIMA_FUNNEL does not ask for presupuesto or influencias', async () => {
    const filtro = await assertDestino(
      OuvZona.EncimaFunnel,
      ouv({ presupuestoConfirmado: false, presupuestoMonto: null }),
    );
    expect(filtro).not.toHaveBeenCalled();
    await assertDestino(
      OuvZona.EncimaFunnel,
      ouv({ presupuestoConfirmado: false, presupuestoMonto: '10' }),
    );
    await assertDestino(
      OuvZona.EncimaFunnel,
      ouv({ presupuestoConfirmado: true, presupuestoMonto: '10' }),
    );
  });

  it('A4 A5: names both phrases when the flag is false and the amount is null or 0', async () => {
    for (const presupuestoMonto of [null, '0'] as const) {
      const blocked = rejectDestino(
        OuvZona.EnFunnel,
        ouv({ presupuestoConfirmado: false, presupuestoMonto }),
      );
      await expect(blocked).rejects.toBeInstanceOf(BadRequestException);
      await expect(blocked).rejects.toThrow(`${confirmado} ${monto}`);
    }
  });

  it('A6: names only the flag when the amount is already above 0', async () => {
    try {
      await rejectDestino(
        OuvZona.EnFunnel,
        ouv({ presupuestoConfirmado: false, presupuestoMonto: '10' }),
      );
      throw new Error('expected the advance to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toBe(confirmado);
    }
  });

  it('A7 A8 A9: names only the amount when it is null, 0 or negative', async () => {
    for (const presupuestoMonto of [null, '0', '-5'] as const) {
      const blocked = rejectDestino(
        OuvZona.EnFunnel,
        ouv({ presupuestoConfirmado: true, presupuestoMonto }),
      );
      await expect(blocked).rejects.toThrow(monto);
    }
  });

  it('rejects decimal string 0.00 and allows 1500000.00', async () => {
    const blocked = rejectDestino(
      OuvZona.EnFunnel,
      ouv({ presupuestoConfirmado: true, presupuestoMonto: '0.00' }),
    );
    await expect(blocked).rejects.toThrow(monto);

    const filtro = await assertDestino(
      OuvZona.EnFunnel,
      ouv({ presupuestoConfirmado: true, presupuestoMonto: '1500000.00' }),
    );
    expect(filtro).not.toHaveBeenCalled();
  });

  it('A10 A11: ENCIMA_FUNNEL to EN_FUNNEL with a valid budget ignores influencias', async () => {
    const filtro = await assertDestino(
      OuvZona.EnFunnel,
      ouv({ presupuestoConfirmado: true, presupuestoMonto: '1' }),
    );
    expect(filtro).not.toHaveBeenCalled();
  });

  it('A12 A13 A16: blocks MAYOR_PROBABILIDAD and names the five types', async () => {
    const { service } = serviceWith({
      influencias: {
        filtroForOuv: jest.fn(async () => ({
          passed: false,
          greenTypes: ['Economica'],
          required: 2,
        })),
      },
    });
    const blocked = service['assertGuardsForDestino'](
      ouv({
        zonaActual: OuvZona.EnFunnel,
        presupuestoConfirmado: false,
        presupuestoMonto: null,
      }),
      OuvZona.MayorProbabilidad,
      transaction as never,
    );
    await expect(blocked).rejects.toBeInstanceOf(InfluenciaProblemException);
    await expect(blocked).rejects.toMatchObject({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
    });
    try {
      await service['assertGuardsForDestino'](
        ouv({ zonaActual: OuvZona.EnFunnel }),
        OuvZona.MayorProbabilidad,
        transaction as never,
      );
    } catch (error) {
      const body = (error as InfluenciaProblemException).getResponse() as {
        type: string;
        status: number;
        detail: string;
      };
      expect(body.type).toBe('about:blank');
      expect(body.status).toBe(422);
      expect(body.detail).toBe(
        'Se requieren 2 tipos de influencia en Verde (Económica, Técnica, Fábrica, Usuario, Coach). Actualmente: 1 (Económica).',
      );
    }
  });

  it('A14 A15 A17 A18: MAYOR_PROBABILIDAD allows a passing filter without presupuesto', async () => {
    const filtro = await assertDestino(
      OuvZona.MayorProbabilidad,
      ouv({
        zonaActual: OuvZona.EnFunnel,
        presupuestoConfirmado: false,
        presupuestoMonto: null,
      }),
      {
        filtroForOuv: jest.fn(async () => ({
          passed: true,
          greenTypes: ['Usuario', 'Coach'],
          required: 2,
        })),
      },
    );
    expect(filtro).toHaveBeenCalled();
  });
});
