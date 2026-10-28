import {
  COMMERCIAL_REPORT_KINDS,
  aggregateForKind,
  buildCommitteeReport,
  buildPipelineHealth,
  listCommercialReportDetails,
  parseAuditAmount,
  type CommercialReportAmountChange,
  type CommercialReportHistory,
  type CommercialReportInput,
  type CommercialReportOuv,
} from './commercial-report-metrics';

const NOW = new Date('2026-10-28T18:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS);
}

function ouv(
  partial: Partial<CommercialReportOuv> & { ouvId: string },
): CommercialReportOuv {
  return {
    consecutivo: partial.ouvId,
    titulo: 'Oportunidad',
    comercialId: 'ana',
    comercialName: 'Ana',
    segmento: 'Industria',
    zonaActual: 'UNIVERSO',
    resultado: 'EnCurso',
    presupuestoMonto: 100,
    montoFinal: 0,
    montoPerdido: 0,
    fechaCierre: null,
    createdAt: new Date('2026-08-15T15:00:00.000Z'),
    updatedAt: NOW,
    origin: null,
    origenVia: 'directa',
    motivoSnapshot: null,
    empresaNombre: 'Acme',
    presupuestoMoneda: 'COP',
    monedaFinal: null,
    expectedCloseDate: '2026-09-15',
    ...partial,
  };
}

function history(
  partial: Partial<CommercialReportHistory> & {
    historyId: string;
    ouvId: string;
    trigger: string;
  },
): CommercialReportHistory {
  return {
    fromEstado: 'UNIVERSO',
    toEstado: 'EN_FUNNEL',
    changedAt: new Date('2026-09-02T15:00:00.000Z'),
    changedBy: 'Ana',
    synthetic: false,
    ...partial,
  };
}

const PERIOD = { year: 2026, quarter: 3 };

function input(
  partial: Partial<CommercialReportInput> & {
    ouvs: CommercialReportOuv[];
  },
): CommercialReportInput {
  return {
    history: [],
    amountChanges: [],
    period: PERIOD,
    fechaCorte: '2026-10-21',
    now: NOW,
    ...partial,
  };
}

describe('parseAuditAmount', () => {
  it('keeps JSON null as null and keeps a real zero', () => {
    expect(parseAuditAmount('null')).toBeNull();
    expect(parseAuditAmount(null)).toBeNull();
    expect(parseAuditAmount('"0"')).toBe(0);
    expect(parseAuditAmount('"0.00"')).toBe(0);
    expect(parseAuditAmount('"7142.00"')).toBe(7142);
    expect(parseAuditAmount('"7563025210"')).toBe(7563025210);
  });
});

describe('commercial report metrics', () => {
  const source = input({
    ouvs: [
      ouv({
        ouvId: 'movil',
        createdAt: new Date('2026-10-22T15:00:00.000Z'),
        presupuestoMonto: 100,
        expectedCloseDate: '2026-09-15',
      }),
      ouv({
        ouvId: 'ganada',
        resultado: 'Ganada',
        montoFinal: 40,
        presupuestoMonto: 40,
        fechaCierre: new Date('2026-10-22T15:00:00.000Z'),
        createdAt: new Date('2026-08-10T15:00:00.000Z'),
        expectedCloseDate: '2026-09-01',
        comercialId: 'luis',
        comercialName: 'Luis',
        segmento: 'Gobierno central',
      }),
      ouv({
        ouvId: 'perdida',
        resultado: 'Perdida',
        presupuestoMonto: 70,
        montoPerdido: 0,
        fechaCierre: new Date('2026-10-23T15:00:00.000Z'),
        createdAt: new Date('2026-01-15T15:00:00.000Z'),
        expectedCloseDate: '2026-08-20',
      }),
      ouv({
        ouvId: 'descartada',
        resultado: 'Descartada',
        presupuestoMonto: 3,
        fechaCierre: new Date('2026-09-04T15:00:00.000Z'),
        createdAt: new Date('2026-09-04T12:00:00.000Z'),
        expectedCloseDate: '2026-09-04',
      }),
      ouv({
        ouvId: 'sin-fecha',
        presupuestoMonto: 15,
        expectedCloseDate: null,
        createdAt: daysAgo(1200),
      }),
      ouv({
        ouvId: 'anio-1',
        presupuestoMonto: 8,
        createdAt: daysAgo(400),
        expectedCloseDate: '2026-10-01',
        segmento: 'Gobierno central',
      }),
      ouv({
        ouvId: 'anio-2',
        presupuestoMonto: 9,
        createdAt: daysAgo(800),
        expectedCloseDate: '2027-01-15',
      }),
      ouv({
        ouvId: 'justo-365',
        presupuestoMonto: 4,
        createdAt: daysAgo(365),
        expectedCloseDate: null,
      }),
    ],
    history: [
      history({
        historyId: 'advance-real',
        ouvId: 'movil',
        trigger: 'ADVANCE',
        changedAt: new Date('2026-10-22T16:00:00.000Z'),
        fromEstado: 'UNIVERSO',
        toEstado: 'EN_FUNNEL',
      }),
      history({
        historyId: 'advance-synthetic',
        ouvId: 'movil',
        trigger: 'ADVANCE',
        changedAt: new Date('2026-10-22T16:30:00.000Z'),
        synthetic: true,
      }),
      history({
        historyId: 'create',
        ouvId: 'movil',
        trigger: 'CREATE',
        fromEstado: null,
        toEstado: 'UNIVERSO',
        changedAt: new Date('2026-09-01T15:00:00.000Z'),
      }),
      history({
        historyId: 'win',
        ouvId: 'ganada',
        trigger: 'WIN',
        fromEstado: 'MAYOR_PROBABILIDAD',
        toEstado: 'Ganada',
        changedAt: new Date('2026-09-02T15:00:00.000Z'),
      }),
      history({
        historyId: 'reopen',
        ouvId: 'ganada',
        trigger: 'MANUAL',
        fromEstado: 'Ganada',
        toEstado: 'EnCurso',
        changedAt: new Date('2026-09-05T15:00:00.000Z'),
      }),
      history({
        historyId: 'retreat',
        ouvId: 'perdida',
        trigger: 'RETREAT',
        fromEstado: 'EN_FUNNEL',
        toEstado: 'ENCIMA_FUNNEL',
        changedAt: new Date('2026-09-01T15:00:00.000Z'),
      }),
      history({
        historyId: 'loss',
        ouvId: 'perdida',
        trigger: 'LOSS',
        fromEstado: 'EN_FUNNEL',
        toEstado: 'Perdida',
        changedAt: new Date('2026-09-03T15:00:00.000Z'),
      }),
      history({
        historyId: 'discard',
        ouvId: 'descartada',
        trigger: 'DISCARD',
        fromEstado: 'EnCurso',
        toEstado: 'Descartada',
        changedAt: new Date('2026-09-04T15:00:00.000Z'),
      }),
    ],
    amountChanges: [
      {
        auditId: 'amount-1',
        ouvId: 'movil',
        campo: 'presupuesto_monto',
        previousAmount: null,
        newAmount: 80,
        changedAt: new Date('2026-10-22T17:00:00.000Z'),
        changedBy: 'Ana',
      },
    ],
  });

  const committee = buildCommitteeReport(source);
  const health = buildPipelineHealth(source);

  it('drops a synthetic row from M035 and M003 and counts it once', () => {
    expect(committee.excluded_synthetic).toBe(1);
    expect(committee.m035.advances.event_count).toBe(1);
    expect(committee.m035.advances.ouv_count).toBe(1);
    expect(committee.m035.advances.cells).toEqual([
      {
        from_estado: 'UNIVERSO',
        to_estado: 'EN_FUNNEL',
        event_count: 1,
        event_amount: 100,
        ouv_count: 1,
        ouv_amount: 100,
      },
    ]);
    expect(committee.m003.zone_changes.event_count).toBe(1);
    expect(committee.m003.zone_changes.ouv_count).toBe(1);
    const advances = listCommercialReportDetails(source, 'm035_advances');
    expect(advances.items.map((item) => item.changed_at)).not.toContain(
      '2026-10-22T16:30:00.000Z',
    );
    const zones = listCommercialReportDetails(source, 'm003_zone_changes');
    expect(zones.total).toBe(1);
  });

  it('counts one OUV once when it advances twice in the quarter', () => {
    const twice = input({
      ouvs: [ouv({ ouvId: 'doble', presupuestoMonto: 250 })],
      history: [
        history({
          historyId: 'doble-1',
          ouvId: 'doble',
          trigger: 'ADVANCE',
          changedAt: new Date('2026-08-10T15:00:00.000Z'),
        }),
        history({
          historyId: 'doble-2',
          ouvId: 'doble',
          trigger: 'ADVANCE',
          changedAt: new Date('2026-09-10T15:00:00.000Z'),
        }),
      ],
    });
    const report = buildCommitteeReport(twice);
    expect(report.m035.advances).toMatchObject({
      event_count: 2,
      event_amount: 500,
      ouv_count: 1,
      ouv_amount: 250,
    });
    expect(report.m035.advances.cells).toEqual([
      {
        from_estado: 'UNIVERSO',
        to_estado: 'EN_FUNNEL',
        event_count: 2,
        event_amount: 500,
        ouv_count: 1,
        ouv_amount: 250,
      },
    ]);
    const details = listCommercialReportDetails(twice, 'm035_advances');
    expect(details.total).toBe(2);
    expect(details.amount_total).toBe(500);
    expect(details.ouv_count).toBe(1);
    expect(details.ouv_amount).toBe(250);
  });

  it('puts MANUAL in reopenings and leaves CREATE out of stage changes', () => {
    expect(committee.m035.reopenings.cells).toEqual([
      {
        from_estado: 'Ganada',
        to_estado: 'EnCurso',
        event_count: 1,
        event_amount: 40,
        ouv_count: 1,
        ouv_amount: 40,
      },
    ]);
    expect(committee.m035.advances.event_count).toBe(1);
    expect(committee.m035.closures.event_count).toBe(3);
    const reopenings = listCommercialReportDetails(source, 'm035_reopenings');
    expect(reopenings.items[0]).toMatchObject({
      from_estado: 'Ganada',
      to_estado: 'EnCurso',
      changed_by: 'Ana',
    });
  });

  it('returns a null previous amount instead of zero', () => {
    const details = listCommercialReportDetails(source, 'm003_amount_changes');
    expect(details.items).toHaveLength(1);
    expect(details.items[0].previous_amount).toBeNull();
    expect(details.items[0].new_amount).toBe(80);
    expect(details.items[0].monto).toBe(80);
    expect(details.amount_total).toBe(80);
  });

  it('counts one mobilized OUV once when it has two movements', () => {
    const single = input({
      ouvs: [
        ouv({
          ouvId: 'doble',
          createdAt: new Date('2026-10-22T15:00:00.000Z'),
          presupuestoMonto: 50,
        }),
      ],
      history: [
        history({
          historyId: 'zone',
          ouvId: 'doble',
          trigger: 'ADVANCE',
          changedAt: new Date('2026-10-23T15:00:00.000Z'),
        }),
      ],
    });
    const report = buildCommitteeReport(single);
    expect(report.m003.new_ouvs.event_count).toBe(1);
    expect(report.m003.zone_changes.event_count).toBe(1);
    expect(report.m003.mobilized.ouv_count).toBe(1);
    expect(report.m003.mobilized.event_count).toBe(2);
  });

  it('keeps a null new amount as null', () => {
    const change: CommercialReportAmountChange = {
      auditId: 'empty',
      ouvId: 'movil',
      campo: 'monto_final',
      previousAmount: null,
      newAmount: null,
      changedAt: new Date('2026-10-22T18:00:00.000Z'),
      changedBy: null,
    };
    const report = buildCommitteeReport(
      input({
        ouvs: [ouv({ ouvId: 'movil', createdAt: daysAgo(10) })],
        amountChanges: [change],
      }),
    );
    const details = listCommercialReportDetails(
      input({
        ouvs: [ouv({ ouvId: 'movil', createdAt: daysAgo(10) })],
        amountChanges: [change],
      }),
      'm003_amount_changes',
    );
    expect(report.m003.amount_changes.event_count).toBe(1);
    expect(report.m003.amount_changes.amount).toBe(0);
    expect(details.items[0].previous_amount).toBeNull();
    expect(details.items[0].new_amount).toBeNull();
    expect(details.items[0].monto).toBeNull();
  });

  it('matches every kind detail with the aggregate', () => {
    for (const kind of COMMERCIAL_REPORT_KINDS) {
      const listed = listCommercialReportDetails(source, kind);
      const figure = aggregateForKind(committee, health, kind);
      expect({
        kind,
        total: listed.total,
        amount: listed.amount_total,
      }).toEqual({
        kind,
        total: figure.total,
        amount: figure.amount,
      });
    }
  });

  it('filters an M035 cell and an M013 resultado with the same amounts', () => {
    const cell = listCommercialReportDetails(source, 'm035_advances', {
      fromEstado: 'UNIVERSO',
      toEstado: 'EN_FUNNEL',
    });
    expect(cell.total).toBe(1);
    expect(cell.amount_total).toBe(
      committee.m035.advances.cells[0].event_amount,
    );
    expect(cell.ouv_count).toBe(committee.m035.advances.cells[0].ouv_count);
    expect(cell.ouv_amount).toBe(committee.m035.advances.cells[0].ouv_amount);

    const ganadas = listCommercialReportDetails(source, 'm013_expected_close', {
      resultado: 'Ganada',
    });
    const bucket = committee.m013.by_resultado.find(
      (row) => row.resultado === 'Ganada',
    );
    expect(ganadas.total).toBe(bucket?.count);
    expect(ganadas.amount_total).toBe(bucket?.amount);
  });

  it('splits open age at 365, 730 and 1095 days and averages every open OUV', () => {
    const aged = input({
      ouvs: [
        ouv({ ouvId: 'd365', createdAt: daysAgo(365), presupuestoMonto: 1 }),
        ouv({ ouvId: 'd366', createdAt: daysAgo(366), presupuestoMonto: 2 }),
        ouv({ ouvId: 'd730', createdAt: daysAgo(730), presupuestoMonto: 3 }),
        ouv({ ouvId: 'd731', createdAt: daysAgo(731), presupuestoMonto: 4 }),
        ouv({ ouvId: 'd1095', createdAt: daysAgo(1095), presupuestoMonto: 5 }),
        ouv({ ouvId: 'd1096', createdAt: daysAgo(1096), presupuestoMonto: 6 }),
        ouv({
          ouvId: 'cerrada',
          resultado: 'Ganada',
          createdAt: daysAgo(2000),
          montoFinal: 99,
        }),
      ],
    });
    const report = buildPipelineHealth(aged);
    expect(report.m023.ranges.map((row) => [row.range, row.count])).toEqual([
      ['1_2', 2],
      ['2_3', 2],
      ['over_3', 1],
    ]);
    expect(report.average_age.by_segment[0]).toMatchObject({
      segmento: 'Industria',
      count: 6,
      amount: 21,
    });
    const ages = [365, 366, 730, 731, 1095, 1096];
    const avg =
      Math.round((ages.reduce((sum, age) => sum + age, 0) / 6) * 10) / 10;
    expect(report.average_age.by_segment[0].avg_days).toBe(avg);
  });

  it('lists missing expected close dates apart from the period funnel', () => {
    expect(committee.m013.missing_expected_close.count).toBe(2);
    const missing = listCommercialReportDetails(source, 'm013_missing_close');
    expect(missing.items.map((item) => item.ouv_id).sort()).toEqual([
      'justo-365',
      'sin-fecha',
    ]);
  });
});
