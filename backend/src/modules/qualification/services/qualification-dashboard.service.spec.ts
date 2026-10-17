import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { OuvResultado, OuvZona } from '../../discovery/models/enums/ouv.enums';
import { QualificationDashboardService } from './qualification-dashboard.service';

const OWNER_ID = 'ejec-1';

function actor(roleName: string, userId = OWNER_ID): AuthenticatedUser {
  return { userId, roleName, permissions: [] };
}

function createService() {
  const ouvFindOne = jest.fn().mockResolvedValue({ count: 0, amount: 0 });
  const ouvFindAndCountAll = jest
    .fn()
    .mockResolvedValue({ rows: [], count: 0 });
  const count = jest.fn().mockResolvedValue(0);
  const service = new QualificationDashboardService(
    { count } as never,
    { count, findAll: jest.fn().mockResolvedValue([]) } as never,
    { count } as never,
    {
      findOne: ouvFindOne,
      findAndCountAll: ouvFindAndCountAll,
      findAll: jest.fn().mockResolvedValue([]),
    } as never,
  );
  return { service, ouvFindOne, ouvFindAndCountAll };
}

function whereOf(call: unknown[]): Record<string, unknown> {
  return (call[0] as { where: Record<string, unknown> }).where;
}

describe('QualificationDashboardService OUV scope', () => {
  it('scopes funnel charts to the logged-in EjecutivoComercial', async () => {
    const { service, ouvFindOne } = createService();

    await service.getDashboard({ year: 2026 }, actor('EjecutivoComercial'));

    expect(ouvFindOne).toHaveBeenCalledTimes(7);
    const zones = ouvFindOne.mock.calls
      .map((call) => whereOf(call).zonaActual)
      .filter(Boolean);
    expect(zones).toEqual([
      OuvZona.Universo,
      OuvZona.EncimaFunnel,
      OuvZona.EnFunnel,
      OuvZona.MayorProbabilidad,
    ]);
    const closed = ouvFindOne.mock.calls
      .map((call) => whereOf(call).resultado)
      .filter((resultado) => resultado !== OuvResultado.EnCurso);
    expect(closed).toEqual([
      OuvResultado.Ganada,
      OuvResultado.Perdida,
      OuvResultado.Descartada,
    ]);
    for (const call of ouvFindOne.mock.calls) {
      expect(whereOf(call).comercialId).toBe(OWNER_ID);
    }
  });

  it('keeps the full OUV cut for roles other than EjecutivoComercial', async () => {
    const { service, ouvFindOne } = createService();

    await service.getDashboard({ year: 2026 }, actor('SoporteComercial'));

    expect(ouvFindOne).toHaveBeenCalledTimes(7);
    for (const call of ouvFindOne.mock.calls) {
      expect(whereOf(call).comercialId).toBeUndefined();
    }
  });

  it('scopes open and closed detail tables to the logged-in ejecutivo', async () => {
    const { service, ouvFindAndCountAll } = createService();
    const ejecutivo = actor('Ejecutivo Comercial');

    await service.getDashboardDetails(
      { kind: 'ouvs_universo', page: 1, limit: 20 },
      ejecutivo,
    );
    await service.getDashboardDetails(
      { kind: 'ouvs_won', year: 2026, page: 1, limit: 20 },
      ejecutivo,
    );
    await service.getDashboardDetails(
      { kind: 'ouvs_lost', year: 2026, page: 1, limit: 20 },
      ejecutivo,
    );
    await service.getDashboardDetails(
      { kind: 'ouvs_discarded', year: 2026, page: 1, limit: 20 },
      ejecutivo,
    );

    expect(ouvFindAndCountAll).toHaveBeenCalledTimes(4);
    expect(whereOf(ouvFindAndCountAll.mock.calls[0])).toMatchObject({
      zonaActual: OuvZona.Universo,
      resultado: OuvResultado.EnCurso,
      comercialId: OWNER_ID,
    });
    expect(whereOf(ouvFindAndCountAll.mock.calls[1]).resultado).toBe(
      OuvResultado.Ganada,
    );
    expect(whereOf(ouvFindAndCountAll.mock.calls[2]).resultado).toBe(
      OuvResultado.Perdida,
    );
    expect(whereOf(ouvFindAndCountAll.mock.calls[3]).resultado).toBe(
      OuvResultado.Descartada,
    );
    for (const call of ouvFindAndCountAll.mock.calls) {
      expect(whereOf(call).comercialId).toBe(OWNER_ID);
    }
  });
});
