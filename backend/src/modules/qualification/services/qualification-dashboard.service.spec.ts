import { Op } from 'sequelize';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  OuvOrigenVia,
  OuvResultado,
  OuvZona,
} from '../../discovery/models/enums/ouv.enums';
import type { QualificationDashboardDetailKind } from '../dtos/qualification-dashboard-detail.dto';
import type {
  QualificationDashboardResponseDto,
  QualificationOuvValueMetricDto,
} from '../dtos/qualification-dashboard.dto';
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

const OTHER_ID = 'ejec-2';
const IN_2026 = new Date(Date.UTC(2026, 5, 15, 15));
const IN_2025 = new Date(Date.UTC(2025, 5, 15, 15));
const RANGE_2026_START = new Date(Date.UTC(2026, 1, 1, 5));
const RANGE_2026_END = new Date(Date.UTC(2027, 1, 1, 5));

type DashboardOuv = {
  ouvId: string;
  titulo: string;
  consecutivo: string;
  segmento: string;
  origenVia: OuvOrigenVia;
  sqlIdOrigen: string | null;
  comercialId: string;
  zonaActual: OuvZona;
  resultado: OuvResultado;
  presupuestoMonto: string | null;
  montoFinal: string | null;
  montoEstimadoPerdido: string | null;
  fechaCierre: Date | null;
  updatedAt: Date;
};

function dashboardOuv(
  partial: Pick<
    DashboardOuv,
    | 'ouvId'
    | 'origenVia'
    | 'comercialId'
    | 'zonaActual'
    | 'resultado'
  > &
    Partial<DashboardOuv>,
): DashboardOuv {
  const desdeSql = partial.origenVia === OuvOrigenVia.DesdeSql;
  return {
    titulo: partial.ouvId,
    consecutivo: partial.ouvId,
    segmento: 'Industria',
    sqlIdOrigen: desdeSql ? `sql-${partial.ouvId}` : null,
    presupuestoMonto: '0',
    montoFinal: null,
    montoEstimadoPerdido: null,
    fechaCierre: partial.resultado === OuvResultado.EnCurso ? null : IN_2026,
    updatedAt: IN_2026,
    ...partial,
  };
}

/** Applies the where the service built. A missing origin clause lets direct rows through. */
function matchesDashboardWhere(
  row: DashboardOuv,
  where: Record<string, unknown>,
): boolean {
  if (where.origenVia != null && row.origenVia !== where.origenVia) {
    return false;
  }
  const sqlId = where.sqlIdOrigen as Record<symbol, unknown> | undefined;
  if (sqlId?.[Op.ne] === null && row.sqlIdOrigen == null) {
    return false;
  }
  if (where.zonaActual != null && row.zonaActual !== where.zonaActual) {
    return false;
  }
  if (where.resultado != null && row.resultado !== where.resultado) {
    return false;
  }
  if (
    typeof where.comercialId === 'string' &&
    row.comercialId !== where.comercialId
  ) {
    return false;
  }
  if (where[Op.and]) {
    const stamp = row.fechaCierre ?? row.updatedAt;
    if (stamp < RANGE_2026_START || stamp >= RANGE_2026_END) {
      return false;
    }
  }
  return true;
}

function summedColumn(attributes: unknown): string {
  if (!Array.isArray(attributes)) return '';
  const amountAttr = attributes[1] as [{ val?: string }, string] | undefined;
  const match = /^COALESCE\(SUM\((.*)\), 0\)$/.exec(amountAttr?.[0]?.val ?? '');
  return match?.[1] ?? '';
}

function rowAmount(row: DashboardOuv, column: string): number {
  if (column === 'presupuesto_monto') {
    return Number(row.presupuestoMonto ?? 0);
  }
  if (column === 'monto_final') {
    return Number(row.montoFinal ?? 0);
  }
  if (column === 'COALESCE(monto_estimado_perdido, presupuesto_monto)') {
    return Number(row.montoEstimadoPerdido ?? row.presupuestoMonto ?? 0);
  }
  return 0;
}

function createLeadOriginService(fixtures: DashboardOuv[]) {
  const ouvFindOne = jest.fn(
    async (options: { where: Record<string, unknown>; attributes?: unknown }) => {
      const matched = fixtures.filter((row) =>
        matchesDashboardWhere(row, options.where),
      );
      const column = summedColumn(options.attributes);
      return {
        count: matched.length,
        amount: matched.reduce((sum, row) => sum + rowAmount(row, column), 0),
      };
    },
  );
  const ouvFindAndCountAll = jest.fn(
    async (options: {
      where: Record<string, unknown>;
      offset?: number;
      limit?: number;
    }) => {
      const matched = fixtures.filter((row) =>
        matchesDashboardWhere(row, options.where),
      );
      const offset = options.offset ?? 0;
      const limit = options.limit ?? matched.length;
      return {
        rows: matched.slice(offset, offset + limit),
        count: matched.length,
      };
    },
  );
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

function blockBMetric(
  data: QualificationDashboardResponseDto,
  kind: QualificationDashboardDetailKind,
): QualificationOuvValueMetricDto {
  switch (kind) {
    case 'ouvs_universo':
      return data.pipeline.open_zonas.universo;
    case 'ouvs_encima_funnel':
      return data.pipeline.open_zonas.encima_funnel;
    case 'ouvs_en_funnel':
      return data.pipeline.open_zonas.en_funnel;
    case 'ouvs_mayor_probabilidad':
      return data.pipeline.open_zonas.mayor_probabilidad;
    case 'ouvs_won':
      return data.pipeline.ouvs_won_in_period;
    case 'ouvs_lost':
      return data.pipeline.ouvs_lost_in_period;
    case 'ouvs_discarded':
      return data.pipeline.ouvs_discarded_in_period;
    default:
      throw new Error(`Not a block B kind: ${kind}`);
  }
}

const BLOCK_B_KINDS: QualificationDashboardDetailKind[] = [
  'ouvs_universo',
  'ouvs_encima_funnel',
  'ouvs_en_funnel',
  'ouvs_mayor_probabilidad',
  'ouvs_won',
  'ouvs_lost',
  'ouvs_discarded',
];

function leadOriginFixtures(): DashboardOuv[] {
  return [
    dashboardOuv({
      ouvId: 'u-lead',
      origenVia: OuvOrigenVia.DesdeSql,
      comercialId: OWNER_ID,
      zonaActual: OuvZona.Universo,
      resultado: OuvResultado.EnCurso,
      presupuestoMonto: '100',
    }),
    dashboardOuv({
      ouvId: 'u-direct',
      origenVia: OuvOrigenVia.Directa,
      sqlIdOrigen: null,
      comercialId: OWNER_ID,
      zonaActual: OuvZona.Universo,
      resultado: OuvResultado.EnCurso,
      presupuestoMonto: '999',
    }),
    dashboardOuv({
      ouvId: 'u-other',
      origenVia: OuvOrigenVia.DesdeSql,
      comercialId: OTHER_ID,
      zonaActual: OuvZona.Universo,
      resultado: OuvResultado.EnCurso,
      presupuestoMonto: '50',
    }),
    dashboardOuv({
      ouvId: 'e-lead',
      origenVia: OuvOrigenVia.DesdeSql,
      comercialId: OWNER_ID,
      zonaActual: OuvZona.EncimaFunnel,
      resultado: OuvResultado.EnCurso,
      presupuestoMonto: '200',
    }),
    dashboardOuv({
      ouvId: 'e-direct',
      origenVia: OuvOrigenVia.Directa,
      sqlIdOrigen: null,
      comercialId: OWNER_ID,
      zonaActual: OuvZona.EncimaFunnel,
      resultado: OuvResultado.EnCurso,
      presupuestoMonto: '888',
    }),
    dashboardOuv({
      ouvId: 'f-lead',
      origenVia: OuvOrigenVia.DesdeSql,
      comercialId: OWNER_ID,
      zonaActual: OuvZona.EnFunnel,
      resultado: OuvResultado.EnCurso,
      presupuestoMonto: '300',
    }),
    dashboardOuv({
      ouvId: 'm-lead',
      origenVia: OuvOrigenVia.DesdeSql,
      comercialId: OWNER_ID,
      zonaActual: OuvZona.MayorProbabilidad,
      resultado: OuvResultado.EnCurso,
      presupuestoMonto: '400',
    }),
    dashboardOuv({
      ouvId: 'g-lead',
      origenVia: OuvOrigenVia.DesdeSql,
      comercialId: OWNER_ID,
      zonaActual: OuvZona.Universo,
      resultado: OuvResultado.Ganada,
      montoFinal: '1000',
    }),
    dashboardOuv({
      ouvId: 'g-direct',
      origenVia: OuvOrigenVia.Directa,
      sqlIdOrigen: null,
      comercialId: OWNER_ID,
      zonaActual: OuvZona.Universo,
      resultado: OuvResultado.Ganada,
      montoFinal: '5000',
    }),
    dashboardOuv({
      ouvId: 'g-other',
      origenVia: OuvOrigenVia.DesdeSql,
      comercialId: OTHER_ID,
      zonaActual: OuvZona.Universo,
      resultado: OuvResultado.Ganada,
      montoFinal: '700',
    }),
    dashboardOuv({
      ouvId: 'p-lead',
      origenVia: OuvOrigenVia.DesdeSql,
      comercialId: OWNER_ID,
      zonaActual: OuvZona.EncimaFunnel,
      resultado: OuvResultado.Perdida,
      montoEstimadoPerdido: '80',
      presupuestoMonto: '10',
    }),
    dashboardOuv({
      ouvId: 'p-fallback',
      origenVia: OuvOrigenVia.DesdeSql,
      comercialId: OWNER_ID,
      zonaActual: OuvZona.EnFunnel,
      resultado: OuvResultado.Perdida,
      montoEstimadoPerdido: null,
      presupuestoMonto: '20',
    }),
    dashboardOuv({
      ouvId: 'p-direct',
      origenVia: OuvOrigenVia.Directa,
      sqlIdOrigen: null,
      comercialId: OWNER_ID,
      zonaActual: OuvZona.EnFunnel,
      resultado: OuvResultado.Perdida,
      montoEstimadoPerdido: '9999',
    }),
    dashboardOuv({
      ouvId: 'd-lead',
      origenVia: OuvOrigenVia.DesdeSql,
      comercialId: OWNER_ID,
      zonaActual: OuvZona.MayorProbabilidad,
      resultado: OuvResultado.Descartada,
      montoEstimadoPerdido: '5',
    }),
    dashboardOuv({
      ouvId: 'd-direct',
      origenVia: OuvOrigenVia.Directa,
      sqlIdOrigen: null,
      comercialId: OWNER_ID,
      zonaActual: OuvZona.MayorProbabilidad,
      resultado: OuvResultado.Descartada,
      montoEstimadoPerdido: '6',
    }),
    dashboardOuv({
      ouvId: 'd-old',
      origenVia: OuvOrigenVia.DesdeSql,
      comercialId: OWNER_ID,
      zonaActual: OuvZona.Universo,
      resultado: OuvResultado.Descartada,
      montoEstimadoPerdido: '1000',
      fechaCierre: IN_2025,
      updatedAt: IN_2025,
    }),
  ];
}

function expectLeadOriginWhere(where: Record<string, unknown>) {
  const sqlId = where.sqlIdOrigen as Record<symbol, unknown>;
  expect(where.origenVia).toBe(OuvOrigenVia.DesdeSql);
  expect(sqlId[Op.ne]).toBeNull();
}

describe('QualificationDashboardService lead origin', () => {
  const soporte = actor('SoporteComercial');

  it('drops a direct OUV from open and closed aggregates and detail', async () => {
    const { service, ouvFindOne, ouvFindAndCountAll } = createLeadOriginService(
      leadOriginFixtures(),
    );

    const dashboard = await service.getDashboard({ year: 2026 }, soporte);

    expect(dashboard.pipeline.open_zonas.universo).toEqual({
      count: 2,
      amount: 150,
    });
    expect(dashboard.pipeline.open_zonas.encima_funnel).toEqual({
      count: 1,
      amount: 200,
    });
    expect(dashboard.pipeline.ouvs_won_in_period).toEqual({
      count: 2,
      amount: 1700,
    });
    expect(dashboard.pipeline.ouvs_lost_in_period).toEqual({
      count: 2,
      amount: 100,
    });
    expect(dashboard.pipeline.ouvs_discarded_in_period).toEqual({
      count: 1,
      amount: 5,
    });
    for (const call of ouvFindOne.mock.calls) {
      expectLeadOriginWhere(whereOf(call));
    }

    const universo = await service.getDashboardDetails(
      { kind: 'ouvs_universo', year: 2026, page: 1, limit: 20 },
      soporte,
    );
    const won = await service.getDashboardDetails(
      { kind: 'ouvs_won', year: 2026, page: 1, limit: 20 },
      soporte,
    );
    expect(universo.items.map((item) => item.id).sort()).toEqual([
      'u-lead',
      'u-other',
    ]);
    expect(won.items.map((item) => item.id).sort()).toEqual([
      'g-lead',
      'g-other',
    ]);
    for (const call of ouvFindAndCountAll.mock.calls) {
      expectLeadOriginWhere(whereOf(call));
    }
  });

  it('keeps a desde_sql OUV with a SQL id in the open zone and the closed period', async () => {
    const { service } = createLeadOriginService(leadOriginFixtures());
    const dashboard = await service.getDashboard({ year: 2026 }, soporte);

    const encima = await service.getDashboardDetails(
      { kind: 'ouvs_encima_funnel', year: 2026, page: 1, limit: 20 },
      soporte,
    );
    const lost = await service.getDashboardDetails(
      { kind: 'ouvs_lost', year: 2026, page: 1, limit: 20 },
      soporte,
    );

    expect(encima.items.map((item) => item.id)).toEqual(['e-lead']);
    expect(encima.total).toBe(dashboard.pipeline.open_zonas.encima_funnel.count);
    expect(lost.items.map((item) => item.id).sort()).toEqual([
      'p-fallback',
      'p-lead',
    ]);
    expect(lost.total).toBe(dashboard.pipeline.ouvs_lost_in_period.count);
  });

  it('matches aggregate count and amount with the detail of every block B kind', async () => {
    const { service } = createLeadOriginService(leadOriginFixtures());
    const dashboard = await service.getDashboard({ year: 2026 }, soporte);

    for (const kind of BLOCK_B_KINDS) {
      const metric = blockBMetric(dashboard, kind);
      const detail = await service.getDashboardDetails(
        { kind, year: 2026, page: 1, limit: 20 },
        soporte,
      );
      const summed = detail.items.reduce(
        (sum, item) => sum + Number(item.amount ?? 0),
        0,
      );
      expect({ kind, total: detail.total, summed }).toEqual({
        kind,
        total: metric.count,
        summed: metric.amount,
      });
    }
  });

  it('applies comercial scope and lead origin together for EjecutivoComercial', async () => {
    const { service, ouvFindOne } = createLeadOriginService(
      leadOriginFixtures(),
    );
    const ejecutivo = actor('EjecutivoComercial');

    const dashboard = await service.getDashboard({ year: 2026 }, ejecutivo);

    expect(dashboard.pipeline.open_zonas.universo).toEqual({
      count: 1,
      amount: 100,
    });
    expect(dashboard.pipeline.ouvs_won_in_period).toEqual({
      count: 1,
      amount: 1000,
    });
    for (const call of ouvFindOne.mock.calls) {
      const where = whereOf(call);
      expectLeadOriginWhere(where);
      expect(where.comercialId).toBe(OWNER_ID);
    }

    const universo = await service.getDashboardDetails(
      { kind: 'ouvs_universo', year: 2026, page: 1, limit: 20 },
      ejecutivo,
    );
    expect(universo.items.map((item) => item.id)).toEqual(['u-lead']);
    expect(universo.total).toBe(1);
  });
});
