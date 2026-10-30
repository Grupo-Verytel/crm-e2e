import {
  buildOuvDashboard,
  listOuvDashboardDetails,
  OUV_DASHBOARD_DETAIL_KINDS,
  resolveOuvDashboardPeriod,
  type OuvDashboardDetailKind,
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
    empresaNombre: partial.empresaNombre ?? 'Acme',
    presupuestoMoneda: partial.presupuestoMoneda ?? 'COP',
    monedaFinal: partial.monedaFinal ?? null,
    ...partial,
  };
}

describe('resolveOuvDashboardPeriod', () => {
  it('uses the fiscal year when only the year is set', () => {
    const resolved = resolveOuvDashboardPeriod({ year: 2026 });
    expect(resolved.current?.start.toISOString()).toBe(
      '2026-02-01T05:00:00.000Z',
    );
    expect(resolved.current?.end.toISOString()).toBe(
      '2027-02-01T05:00:00.000Z',
    );
    expect(resolved.previous?.start.toISOString()).toBe(
      '2025-02-01T05:00:00.000Z',
    );
  });

  it('uses the Verytel quarter inside the selected year', () => {
    const resolved = resolveOuvDashboardPeriod({ year: 2026, quarter: 4 });
    expect(resolved.current?.start.toISOString()).toBe(
      '2026-11-01T05:00:00.000Z',
    );
    expect(resolved.current?.end.toISOString()).toBe(
      '2027-02-01T05:00:00.000Z',
    );
    expect(resolved.previous?.start.toISOString()).toBe(
      '2026-08-01T05:00:00.000Z',
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
      createdAt: new Date('2026-07-01T05:00:00.000Z'),
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
      fechaCierre: new Date('2026-07-15T05:00:00.000Z'),
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
    row({
      ouvId: 'discarded',
      consecutivo: 'OUV-D',
      resultado: 'Descartada',
      presupuestoMonto: 999,
      fechaCierre: new Date('2026-09-01T05:00:00.000Z'),
      segmento: 'Otros',
      empresaNombre: 'Descartada SA',
    }),
  ];

  const dashboard = buildOuvDashboard(rows, { year: 2026, quarter: 3 }, NOW);

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
    expect(luis?.win_rate_amount).toBe(0);
    const industria = dashboard.pipeline_by_sector.find(
      (item) => item.segmento === 'Industria',
    );
    expect(industria?.win_rate).toBe(0);
    expect(industria?.win_rate_amount).toBe(0);
    expect(industria?.open_count).toBe(1);
  });

  it('adds an amount win rate without changing the count rate', () => {
    expect(dashboard.close_rate.rate).toBe(0.5);
    expect(dashboard.close_rate.rate_amount).toBe(0.3636);
    expect(dashboard.close_rate.won_count).toBe(1);
    expect(dashboard.close_rate.lost_count).toBe(1);
  });

  it('breaks open, won and lost by segmento with both win rates', () => {
    expect(dashboard.by_segment).toEqual([
      {
        segmento: 'Defensa y seguridad',
        open_count: 1,
        open_amount: 25,
        won_count: 0,
        won_amount: 0,
        lost_count: 0,
        lost_amount: 0,
        win_rate: null,
        win_rate_amount: null,
      },
      {
        segmento: 'Gobierno central',
        open_count: 1,
        open_amount: 100,
        won_count: 1,
        won_amount: 40,
        lost_count: 0,
        lost_amount: 0,
        win_rate: 1,
        win_rate_amount: 1,
      },
      {
        segmento: 'Industria',
        open_count: 1,
        open_amount: 200,
        won_count: 0,
        won_amount: 0,
        lost_count: 1,
        lost_amount: 70,
        win_rate: 0,
        win_rate_amount: 0,
      },
    ]);
    expect(dashboard.mayor_probabilidad_by_segment).toEqual([
      { segmento: 'Industria', count: 1, amount: 200 },
    ]);
  });

  it('keeps detail sums equal to the segment and executive aggregates', () => {
    const input = { year: 2026, quarter: 3 };
    for (const kind of OUV_DASHBOARD_DETAIL_KINDS) {
      const details = listOuvDashboardDetails(rows, input, kind);
      expect(details.map((item) => item.ouv_id)).not.toContain('discarded');
      expect(rounded(sumMonto(details))).toBe(aggregateAmount(dashboard, kind));
      expect(details.length).toBe(aggregateCount(dashboard, kind));
    }

    const gobierno = listOuvDashboardDetails(
      rows,
      input,
      'open_by_segment',
    ).filter((item) => item.segmento === 'Gobierno central');
    const gobiernoBucket = dashboard.by_segment.find(
      (item) => item.segmento === 'Gobierno central',
    );
    expect(gobierno).toHaveLength(gobiernoBucket?.open_count ?? -1);
    expect(rounded(sumMonto(gobierno))).toBe(gobiernoBucket?.open_amount);

    const luisWon = listOuvDashboardDetails(
      rows,
      input,
      'won_by_executive',
    ).filter((item) => item.comercial === 'Luis');
    const luis = dashboard.executives.find((item) => item.full_name === 'Luis');
    expect(rounded(sumMonto(luisWon))).toBe(luis?.won_amount);

    const anaOpen = listOuvDashboardDetails(
      rows,
      input,
      'open_by_executive',
    ).filter((item) => item.comercial === 'Ana');
    expect(anaOpen.map((item) => item.ouv_id).sort()).toEqual([
      'new-q4',
      'open-universo',
    ]);
    expect(rounded(sumMonto(anaOpen))).toBe(125);
  });

  it('matches each executive open_count_now with the open detail', () => {
    const input = { year: 2026, quarter: 3 };
    const details = listOuvDashboardDetails(rows, input, 'open_by_executive');
    for (const executive of dashboard.executives) {
      const own = details.filter(
        (item) => item.comercial === executive.full_name,
      );
      expect(own).toHaveLength(executive.open_count_now);
      expect(rounded(sumMonto(own))).toBe(executive.open_amount_now);
    }
    const industria = dashboard.pipeline_by_sector.find(
      (item) => item.segmento === 'Industria',
    );
    expect(industria?.open_amount_now).toBe(200);
    expect(industria?.amount).toBe(200);
  });
});

describe('dashboard detail predicates', () => {
  it('uses presupuesto when the lost amount is zero and still counts USD', () => {
    const fixture = [
      row({
        ouvId: 'won-cop',
        resultado: 'Ganada',
        montoFinal: 40,
        monedaFinal: 'COP',
        fechaCierre: new Date('2026-09-01T05:00:00.000Z'),
        segmento: 'Industria',
      }),
      row({
        ouvId: 'lost-fallback',
        resultado: 'Perdida',
        presupuestoMonto: 80,
        montoPerdido: 0,
        fechaCierre: new Date('2026-09-02T05:00:00.000Z'),
        segmento: 'Industria',
      }),
      row({
        ouvId: 'open-usd',
        resultado: 'EnCurso',
        presupuestoMonto: 10,
        presupuestoMoneda: 'USD',
        segmento: 'Industria',
        empresaNombre: 'Dollar Co',
      }),
      row({
        ouvId: 'discarded-usd',
        resultado: 'Descartada',
        presupuestoMonto: 500,
        presupuestoMoneda: 'USD',
        segmento: 'Industria',
      }),
    ];
    const input = { year: 2026, quarter: 3 };
    const built = buildOuvDashboard(fixture, input, NOW);
    expect(built.close_rate.rate).toBe(0.5);
    expect(built.close_rate.rate_amount).toBe(0.3333);
    const lost = listOuvDashboardDetails(fixture, input, 'lost_by_segment');
    expect(lost.map((item) => item.ouv_id)).toEqual(['lost-fallback']);
    expect(lost[0].monto).toBe(80);
    const open = listOuvDashboardDetails(fixture, input, 'open_by_segment');
    expect(open.map((item) => item.ouv_id)).toEqual(['open-usd']);
    expect(open[0].moneda).toBe('USD');
    expect(built.by_segment[0].open_amount).toBe(10);
  });

  it('does not treat a future close as an open EnCurso row', () => {
    const fixture = [
      row({
        ouvId: 'closing-later',
        resultado: 'Ganada',
        zonaActual: 'MAYOR_PROBABILIDAD',
        presupuestoMonto: 15,
        montoFinal: 15,
        fechaCierre: new Date('2026-10-20T05:00:00.000Z'),
        segmento: 'Otros',
      }),
    ];
    const built = buildOuvDashboard(fixture, { year: 2026, quarter: 3 }, NOW);
    expect(built.pipeline_value.count).toBe(1);
    expect(built.pipeline_value.amount).toBe(15);
    expect(built.executives[0].open_count).toBe(1);
    expect(built.executives[0].pipeline_amount).toBe(15);
    expect(built.executives[0].open_count_now).toBe(0);
    expect(built.executives[0].open_amount_now).toBe(0);
    expect(built.by_segment[0].open_count).toBe(0);
    expect(built.by_segment[0].won_count).toBe(1);
    expect(built.mayor_probabilidad_by_segment).toEqual([]);
  });
});

function sumMonto(items: { monto: number }[]): number {
  return items.reduce((sum, item) => sum + item.monto, 0);
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function aggregateAmount(
  dashboard: ReturnType<typeof buildOuvDashboard>,
  kind: OuvDashboardDetailKind,
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
  dashboard: ReturnType<typeof buildOuvDashboard>,
  kind: OuvDashboardDetailKind,
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
