import { HttpStatus } from '@nestjs/common';
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
    { findLeadById: jest.fn(), assertSegmentSubsegment: jest.fn(), ...overrides.demand } as never,
    { getPeopleWithAccounts: jest.fn(), getAccount: jest.fn(), ...overrides.accounts } as never,
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
        getPeopleWithAccounts: jest.fn(async () =>
          new Map([
            [
              'person-1',
              { account_id: 'acc-1', account_name: 'Empresa' },
            ],
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

describe('assertGuardsForDestino filter D3', () => {
  it('blocks the advance with RFC 7807 naming the green types', async () => {
    const { service } = serviceWith({
      influencias: {
        filtroForOuv: jest.fn(async () => ({
          passed: false,
          greenTypes: ['Economica'],
          required: 2,
        })),
      },
    });
    const ouv = {
      zonaActual: OuvZona.EncimaFunnel,
      presupuestoConfirmado: true,
    } as never;
    const blocked = service['assertGuardsForDestino'](
      ouv,
      OuvZona.EnFunnel,
      transaction as never,
    );
    await expect(blocked).rejects.toBeInstanceOf(InfluenciaProblemException);
    await expect(blocked).rejects.toMatchObject({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
    });
    try {
      await service['assertGuardsForDestino'](
        ouv,
        OuvZona.EnFunnel,
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
        'Se requieren 2 tipos de influencia en Verde (Económica, Técnica, Fábrica). Actualmente: 1 (Económica).',
      );
    }
  });
});
