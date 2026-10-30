import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { OUV_DASHBOARD_DETAIL_KINDS } from '../lib/ouv-dashboard-metrics';
import { OuvDashboardService } from './ouv-dashboard.service';

const ANA = 'user-ana';
const LUIS = 'user-luis';

function actor(roleName: string, userId = ANA): AuthenticatedUser {
  return { userId, roleName, permissions: [] };
}

function ouv(partial: {
  ouvId: string;
  comercialId?: string;
  comercialName?: string;
  segmento?: string;
  zonaActual?: string;
  resultado?: string;
  presupuestoMonto?: string | null;
  montoFinal?: string | null;
  montoEstimadoPerdido?: string | null;
  fechaCierre?: Date | null;
  presupuestoMoneda?: string | null;
  monedaFinal?: string | null;
  empresaNombre?: string;
}) {
  return {
    ouvId: partial.ouvId,
    consecutivo: partial.ouvId,
    titulo: 'Oportunidad',
    comercialId: partial.comercialId ?? ANA,
    segmento: partial.segmento ?? 'Industria',
    zonaActual: partial.zonaActual ?? 'UNIVERSO',
    resultado: partial.resultado ?? 'EnCurso',
    presupuestoMonto: partial.presupuestoMonto ?? '100',
    montoFinal: partial.montoFinal ?? null,
    montoEstimadoPerdido: partial.montoEstimadoPerdido ?? null,
    fechaCierre: partial.fechaCierre ?? null,
    createdAt: new Date('2026-03-01T05:00:00.000Z'),
    updatedAt: new Date('2026-10-01T05:00:00.000Z'),
    origin: null,
    origenVia: 'directa',
    motivoSnapshot: null,
    empresaNombre: partial.empresaNombre ?? 'Acme',
    presupuestoMoneda: partial.presupuestoMoneda ?? 'COP',
    monedaFinal: partial.monedaFinal ?? null,
    comercial: { fullName: partial.comercialName ?? 'Ana' },
  };
}

const FIXTURE = [
  ouv({ ouvId: 'open-ana', presupuestoMonto: '100', comercialName: 'Ana' }),
  ouv({
    ouvId: 'open-luis',
    comercialId: LUIS,
    comercialName: 'Luis',
    zonaActual: 'MAYOR_PROBABILIDAD',
    presupuestoMonto: '50',
    segmento: 'Gobierno central',
  }),
  ouv({
    ouvId: 'won-ana',
    resultado: 'Ganada',
    montoFinal: '40',
    monedaFinal: 'COP',
    fechaCierre: new Date('2026-09-01T05:00:00.000Z'),
    presupuestoMonto: '40',
  }),
  ouv({
    ouvId: 'lost-luis',
    comercialId: LUIS,
    comercialName: 'Luis',
    resultado: 'Perdida',
    montoEstimadoPerdido: '0',
    presupuestoMonto: '70',
    fechaCierre: new Date('2026-09-02T05:00:00.000Z'),
    segmento: 'Gobierno central',
  }),
  ouv({
    ouvId: 'discarded',
    resultado: 'Descartada',
    presupuestoMonto: '999',
    fechaCierre: new Date('2026-09-03T05:00:00.000Z'),
  }),
  ouv({
    ouvId: 'open-usd',
    presupuestoMonto: '10',
    presupuestoMoneda: 'USD',
    empresaNombre: 'Dollar Co',
  }),
];

function createService(rows = FIXTURE) {
  const findAll = jest.fn().mockResolvedValue(rows);
  const service = new OuvDashboardService({ findAll } as never);
  return { service, findAll };
}

function whereOf(call: unknown[]): Record<string, unknown> {
  return (call[0] as { where: Record<string, unknown> }).where;
}

describe('OuvDashboardService scope', () => {
  it('limits EjecutivoComercial to their own OUVs on the board and the detail', async () => {
    const { service, findAll } = createService();
    const ejecutivo = actor('EjecutivoComercial', ANA);

    await service.getDashboard({ year: 2026, comercial_id: LUIS }, ejecutivo);
    await service.getDetails(
      {
        kind: 'open_by_segment',
        year: 2026,
        comercial_id: LUIS,
        page: 1,
        limit: 20,
      },
      ejecutivo,
    );

    expect(findAll).toHaveBeenCalledTimes(2);
    for (const call of findAll.mock.calls as unknown[][]) {
      expect(whereOf(call).comercialId).toBe(ANA);
    }
  });

  it('keeps comercial_id optional for roles that can read every OUV', async () => {
    const { service, findAll } = createService();

    await service.getDashboard({ year: 2026 }, actor('SoporteComercial'));
    const calls = findAll.mock.calls as unknown[][];
    expect(whereOf(calls[0]).comercialId).toBeUndefined();

    await service.getDetails(
      {
        kind: 'won_by_executive',
        year: 2026,
        comercial_id: LUIS,
        page: 1,
        limit: 20,
      },
      actor('Gerente Comercial'),
    );
    expect(whereOf(calls[1]).comercialId).toBe(LUIS);
  });

  it('matches every detail kind with the aggregate and drops Descartada from open', async () => {
    const { service } = createService();
    const user = actor('SoporteComercial');
    const dashboard = await service.getDashboard(
      { year: 2026, quarter: 3 },
      user,
    );

    for (const kind of OUV_DASHBOARD_DETAIL_KINDS) {
      const full = await service.getDetails(
        { kind, year: 2026, quarter: 3, page: 1, limit: 50 },
        user,
      );
      expect(full.items.map((item) => item.ouv_id)).not.toContain('discarded');
      expect(full.amount_total).toBe(aggregateAmount(dashboard, kind));
      expect(
        rounded(full.items.reduce((sum, item) => sum + item.monto, 0)),
      ).toBe(aggregateAmount(dashboard, kind));
      expect(full.total).toBe(aggregateCount(dashboard, kind));
    }

    const pageOne = await service.getDetails(
      { kind: 'open_by_segment', year: 2026, quarter: 3, page: 1, limit: 1 },
      user,
    );
    const pageTwo = await service.getDetails(
      { kind: 'open_by_segment', year: 2026, quarter: 3, page: 2, limit: 1 },
      user,
    );
    expect(pageOne.total).toBe(3);
    expect(pageOne.items).toHaveLength(1);
    expect(pageTwo.items).toHaveLength(1);
    expect(pageOne.items[0].ouv_id).not.toBe(pageTwo.items[0].ouv_id);

    const open = await service.getDetails(
      { kind: 'open_by_segment', year: 2026, quarter: 3, page: 1, limit: 50 },
      user,
    );
    expect(open.items.map((item) => item.ouv_id).sort()).toEqual([
      'open-ana',
      'open-luis',
      'open-usd',
    ]);
    expect(open.items.find((item) => item.ouv_id === 'open-usd')?.moneda).toBe(
      'USD',
    );
  });
});

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function aggregateAmount(
  dashboard: Awaited<ReturnType<OuvDashboardService['getDashboard']>>,
  kind: (typeof OUV_DASHBOARD_DETAIL_KINDS)[number],
): number {
  if (kind === 'open_by_segment' || kind === 'open_by_executive') {
    return rounded(
      dashboard.by_segment.reduce((sum, item) => sum + item.open_amount, 0),
    );
  }
  if (kind === 'won_by_segment' || kind === 'won_by_executive') {
    return rounded(
      dashboard.by_segment.reduce((sum, item) => sum + item.won_amount, 0),
    );
  }
  if (kind === 'lost_by_segment') {
    return rounded(
      dashboard.by_segment.reduce((sum, item) => sum + item.lost_amount, 0),
    );
  }
  return rounded(
    dashboard.mayor_probabilidad_by_segment.reduce(
      (sum, item) => sum + item.amount,
      0,
    ),
  );
}

function aggregateCount(
  dashboard: Awaited<ReturnType<OuvDashboardService['getDashboard']>>,
  kind: (typeof OUV_DASHBOARD_DETAIL_KINDS)[number],
): number {
  if (kind === 'open_by_segment' || kind === 'open_by_executive') {
    return dashboard.by_segment.reduce((sum, item) => sum + item.open_count, 0);
  }
  if (kind === 'won_by_segment' || kind === 'won_by_executive') {
    return dashboard.by_segment.reduce((sum, item) => sum + item.won_count, 0);
  }
  if (kind === 'lost_by_segment') {
    return dashboard.by_segment.reduce((sum, item) => sum + item.lost_count, 0);
  }
  return dashboard.mayor_probabilidad_by_segment.reduce(
    (sum, item) => sum + item.count,
    0,
  );
}
