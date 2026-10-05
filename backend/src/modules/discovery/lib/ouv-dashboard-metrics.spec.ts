import {
  buildOuvDashboard,
  resolveOuvDashboardPeriod,
  type OuvDashboardSourceRow,
} from './ouv-dashboard-metrics';

const NOW = new Date('2026-10-05T15:00:00.000Z');

function row(
  partial: Partial<OuvDashboardSourceRow> &
    Pick<OuvDashboardSourceRow, 'ouvId'>,
): OuvDashboardSourceRow {
  return {
    consecutivo: partial.ouvId,
    titulo: partial.titulo ?? 'Oportunidad',
    comercialId: partial.comercialId ?? 'comercial-a',
    comercialName: partial.comercialName ?? 'Ana',
    segmento: partial.segmento ?? 'Gobierno central',
    zonaActual: partial.zonaActual ?? 'UNIVERSO',
    resultado: partial.resultado ?? 'EnCurso',
    presupuestoMonto: partial.presupuestoMonto ?? 0,
    montoFinal: partial.montoFinal ?? 0,
    montoPerdido: partial.montoPerdido ?? 0,
    fechaCierre: partial.fechaCierre ?? null,
    createdAt: partial.createdAt ?? new Date('2026-01-15T05:00:00.000Z'),
    updatedAt: partial.updatedAt ?? new Date('2026-10-01T05:00:00.000Z'),
    origin: partial.origin ?? null,
    origenVia: partial.origenVia ?? 'directa',
    motivoSnapshot: partial.motivoSnapshot ?? null,
    ...partial,
  };
}

describe('resolveOuvDashboardPeriod', () => {
  it('uses the calendar year when only the year is set', () => {
    const resolved = resolveOuvDashboardPeriod({ year: 2026 });
    expect(resolved.current?.start.toISOString()).toBe(
      '2026-01-01T05:00:00.000Z',
    );
    expect(resolved.current?.end.toISOString()).toBe(
      '2027-01-01T05:00:00.000Z',
    );
    expect(resolved.previous?.start.toISOString()).toBe(
      '2025-01-01T05:00:00.000Z',
    );
  });

  it('uses the quarter inside the selected year', () => {
    const resolved = resolveOuvDashboardPeriod({ year: 2026, quarter: 4 });
    expect(resolved.current?.start.toISOString()).toBe(
      '2026-10-01T05:00:00.000Z',
    );
    expect(resolved.current?.end.toISOString()).toBe(
      '2027-01-01T05:00:00.000Z',
    );
    expect(resolved.previous?.start.toISOString()).toBe(
      '2026-07-01T05:00:00.000Z',
    );
  });

  it('prefers an explicit date range over year and quarter', () => {
    const resolved = resolveOuvDashboardPeriod({
      year: 2024,
      quarter: 1,
      periodFrom: '2026-03-01',
      periodTo: '2026-03-15',
    });
    expect(resolved.year).toBeNull();
    expect(resolved.current?.start.toISOString()).toBe(
      '2026-03-01T05:00:00.000Z',
    );
    expect(resolved.current?.end.toISOString()).toBe(
      '2026-03-16T05:00:00.000Z',
    );
  });
});

describe('buildOuvDashboard', () => {
  const rows = [
    row({
      ouvId: 'open-universo',
      consecutivo: 'OUV-1',
      presupuestoMonto: 100,
      updatedAt: new Date('2026-08-01T05:00:00.000Z'),
      comercialId: 'comercial-a',
      comercialName: 'Ana',
      segmento: 'Gobierno central',
    }),
    row({
      ouvId: 'open-mayor',
      zonaActual: 'MAYOR_PROBABILIDAD',
      presupuestoMonto: 200,
      createdAt: new Date('2026-08-01T05:00:00.000Z'),
      updatedAt: new Date('2026-10-04T05:00:00.000Z'),
      comercialId: 'comercial-b',
      comercialName: 'Luis',
      segmento: 'Industria',
    }),
    row({
      ouvId: 'won-q4',
      resultado: 'Ganada',
      zonaActual: 'MAYOR_PROBABILIDAD',
      presupuestoMonto: 50,
      montoFinal: 40,
      createdAt: new Date('2026-07-01T05:00:00.000Z'),
      fechaCierre: new Date('2026-10-02T05:00:00.000Z'),
      origin: 'Licitación pública',
      segmento: 'Gobierno central',
    }),
    row({
      ouvId: 'lost-q4',
      resultado: 'Perdida',
      zonaActual: 'EN_FUNNEL',
      presupuestoMonto: 80,
      montoPerdido: 70,
      createdAt: new Date('2026-06-01T05:00:00.000Z'),
      fechaCierre: new Date('2026-10-03T05:00:00.000Z'),
      motivoSnapshot: 'Precio',
      segmento: 'Industria',
      comercialId: 'comercial-b',
      comercialName: 'Luis',
    }),
    row({
      ouvId: 'won-q3',
      resultado: 'Ganada',
      montoFinal: 30,
      createdAt: new Date('2026-05-01T05:00:00.000Z'),
      fechaCierre: new Date('2026-09-01T05:00:00.000Z'),
      segmento: 'Industria',
    }),
    row({
      ouvId: 'new-q4',
      presupuestoMonto: 25,
      createdAt: new Date('2026-10-02T05:00:00.000Z'),
      updatedAt: new Date('2026-10-04T05:00:00.000Z'),
      origenVia: 'desde_sql',
      segmento: 'Defensa y seguridad',
    }),
  ];

  const dashboard = buildOuvDashboard(rows, { year: 2026, quarter: 4 }, NOW);

  it('weights the open pipeline by zone and compares it with the previous period', () => {
    expect(dashboard.pipeline_weighted.amount).toBe(162.5);
    expect(dashboard.pipeline_weighted.weight_share).toBe(0.5);
    expect(dashboard.pipeline_value.count).toBe(3);
    expect(dashboard.pipeline_value.amount).toBe(325);
    expect(dashboard.pipeline_value.delta_ratio).not.toBeNull();
  });

  it('computes close rate in percentage points against the previous quarter', () => {
    expect(dashboard.close_rate.won_count).toBe(1);
    expect(dashboard.close_rate.lost_count).toBe(1);
    expect(dashboard.close_rate.rate).toBe(0.5);
    expect(dashboard.close_rate.delta_points).toBe(-50);
  });

  it('averages the won sales cycle and keeps loss reasons', () => {
    expect(dashboard.sales_cycle.avg_days).toBe(93);
    expect(dashboard.won_vs_lost.won.amount).toBe(40);
    expect(dashboard.won_vs_lost.lost.amount).toBe(70);
    expect(dashboard.won_vs_lost.loss_reasons).toEqual([
      { label: 'Precio', count: 1, share: 1 },
    ]);
  });

  it('counts new OUVs and their origin inside the quarter', () => {
    expect(dashboard.new_ouvs).toEqual({ count: 1, amount: 25 });
    expect(dashboard.new_origins).toEqual([{ label: 'Desde SQL', count: 1 }]);
  });

  it('flags OUVs with no movement for more than 30 days', () => {
    expect(dashboard.stalled.map((item) => item.ouv_id)).toEqual([
      'open-universo',
    ]);
    expect(dashboard.stalled[0].days_stale).toBeGreaterThan(30);
  });

  it('reports executive pipeline and sector win rate', () => {
    const luis = dashboard.executives.find((item) => item.full_name === 'Luis');
    expect(luis?.pipeline_amount).toBe(200);
    expect(luis?.win_rate).toBe(0);
    const industria = dashboard.pipeline_by_sector.find(
      (item) => item.segmento === 'Industria',
    );
    expect(industria?.win_rate).toBe(0);
  });
});
