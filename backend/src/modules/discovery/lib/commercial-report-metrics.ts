import {
  addBogotaCalendarDays,
  bogotaCalendarDaysBetween,
  bogotaDayStartFromYmd,
  bogotaYmd,
} from '../../../common/time/bogota-day';
import {
  isDashboardOpen,
  isLostInPeriod,
  isWonInPeriod,
  lostAmount,
  resolveOuvDashboardPeriod,
  type OuvDashboardPeriodInput,
  type OuvDashboardSourceRow,
} from './ouv-dashboard-metrics';

/**
 * Committee and pipeline-health math.
 *
 * Open / won / lost reuse the dashboard predicates. The universe is the same
 * loaded set: origen_via directa stays in, and ouv_type is not filtered.
 * Amounts stay in the stored currency (COP in this environment).
 *
 * M003 uses [fecha_corte, end of today) in America/Bogota. M035, M025 and
 * M013 use the dashboard period (fiscal quarter or period_from/period_to).
 */

export const COMMERCIAL_REPORT_AMOUNT_FIELDS = [
  'presupuesto_monto',
  'monto_final',
] as const;

export const COMMITTEE_DETAIL_KINDS = [
  'm003_new',
  'm003_zone_changes',
  'm003_amount_changes',
  'm003_won',
  'm003_lost',
  'm003_mobilized',
  'm035_advances',
  'm035_retreats',
  'm035_closures',
  'm035_reopenings',
  'm025_new',
  'm013_expected_close',
  'm013_created_in_period',
  'm013_missing_close',
] as const;

export const PIPELINE_DETAIL_KINDS = [
  'm023_1_2',
  'm023_2_3',
  'm023_over_3',
  'm023_aged',
  'open_average_age',
] as const;

export const COMMERCIAL_REPORT_KINDS = [
  ...COMMITTEE_DETAIL_KINDS,
  ...PIPELINE_DETAIL_KINDS,
] as const;

export type CommitteeDetailKind = (typeof COMMITTEE_DETAIL_KINDS)[number];
export type PipelineDetailKind = (typeof PIPELINE_DETAIL_KINDS)[number];
export type CommercialReportKind = (typeof COMMERCIAL_REPORT_KINDS)[number];
export type CommercialReportName = 'committee' | 'pipeline-health';

export type AgeRangeId = '1_2' | '2_3' | 'over_3';

const AGE_RANGES: { range: AgeRangeId; label: string }[] = [
  { range: '1_2', label: '1–2 años' },
  { range: '2_3', label: '2–3 años' },
  { range: 'over_3', label: 'Más de 3 años' },
];

const RESULTADO_ORDER = ['EnCurso', 'Ganada', 'Perdida', 'Descartada'];

export type CommercialReportOuv = OuvDashboardSourceRow & {
  expectedCloseDate: string | null;
};

export type CommercialReportHistory = {
  historyId: string;
  ouvId: string;
  fromEstado: string | null;
  toEstado: string;
  trigger: string;
  changedAt: Date;
  changedBy: string | null;
  synthetic: boolean;
};

export type CommercialReportAmountChange = {
  auditId: string;
  ouvId: string;
  campo: string;
  previousAmount: number | null;
  newAmount: number | null;
  changedAt: Date;
  changedBy: string | null;
};

export type CommercialReportInput = {
  ouvs: CommercialReportOuv[];
  history: CommercialReportHistory[];
  amountChanges: CommercialReportAmountChange[];
  period: OuvDashboardPeriodInput;
  fechaCorte?: string;
  now: Date;
};

export type CountAmount = { count: number; amount: number };

export type MobilizationBlock = {
  ouv_count: number;
  event_count: number;
  amount: number;
};

export type StageCell = {
  from_estado: string | null;
  to_estado: string;
  event_count: number;
  event_amount: number;
  ouv_count: number;
  ouv_amount: number;
};

export type StageBlock = {
  event_count: number;
  event_amount: number;
  ouv_count: number;
  ouv_amount: number;
  cells: StageCell[];
};

export type CommitteeReport = {
  period: {
    period_from: string | null;
    period_to: string | null;
    year: number | null;
    quarter: number | null;
  };
  fecha_corte: string;
  as_of: string;
  excluded_synthetic: number;
  m003: {
    mobilized: MobilizationBlock;
    new_ouvs: MobilizationBlock;
    zone_changes: MobilizationBlock;
    amount_changes: MobilizationBlock;
    won: MobilizationBlock;
    lost: MobilizationBlock;
  };
  m035: {
    advances: StageBlock;
    retreats: StageBlock;
    closures: StageBlock;
    reopenings: StageBlock;
  };
  m025: {
    by_segment: { segmento: string; count: number; amount: number }[];
    by_commercial: {
      user_id: string;
      full_name: string;
      count: number;
      amount: number;
    }[];
  };
  m013: {
    by_resultado: {
      resultado: string;
      count: number;
      amount: number;
      created_in_period: number;
      created_in_period_amount: number;
    }[];
    created_in_period: CountAmount;
    missing_expected_close: CountAmount;
  };
};

export type PipelineHealthReport = {
  as_of: string;
  m023: {
    ranges: {
      range: AgeRangeId;
      label: string;
      count: number;
      amount: number;
    }[];
    by_segment: {
      segmento: string;
      ranges: { range: AgeRangeId; count: number; amount: number }[];
    }[];
    by_commercial: {
      user_id: string;
      full_name: string;
      ranges: { range: AgeRangeId; count: number; amount: number }[];
    }[];
  };
  average_age: {
    by_segment: {
      segmento: string;
      count: number;
      amount: number;
      avg_days: number;
    }[];
  };
};

export type CommercialReportDetailItem = {
  ouv_id: string;
  consecutivo: string;
  titulo: string;
  empresa: string;
  comercial: string;
  segmento: string;
  zona: string;
  monto: number | null;
  fecha: string | null;
  from_estado: string | null;
  to_estado: string | null;
  changed_at: string | null;
  changed_by: string | null;
  previous_amount: number | null;
  new_amount: number | null;
  campo: string | null;
};

export type CommercialReportDetailFilters = {
  fromEstado?: string;
  toEstado?: string;
  resultado?: string;
};

type HalfOpenRange = { start: Date; end: Date };

type StageBucket = 'advance' | 'retreat' | 'closure' | 'reopening';

type LinkedStage = {
  ouv: CommercialReportOuv;
  fromEstado: string | null;
  toEstado: string;
  changedAt: Date;
  changedBy: string | null;
  bucket: StageBucket;
};

type LinkedAmount = {
  ouv: CommercialReportOuv;
  campo: string;
  previousAmount: number | null;
  newAmount: number | null;
  changedAt: Date;
  changedBy: string | null;
};

type Collected = {
  period: HalfOpenRange | null;
  periodMeta: CommitteeReport['period'];
  mobilization: HalfOpenRange;
  fechaCorte: string;
  asOf: string;
  excludedSynthetic: number;
  newInWindow: CommercialReportOuv[];
  zoneInWindow: LinkedStage[];
  amountsInWindow: LinkedAmount[];
  wonInWindow: CommercialReportOuv[];
  lostInWindow: CommercialReportOuv[];
  mobilized: CommercialReportOuv[];
  stagesInPeriod: Record<StageBucket, LinkedStage[]>;
  newInPeriod: CommercialReportOuv[];
  funnel: CommercialReportOuv[];
  funnelCreated: CommercialReportOuv[];
  missingClose: CommercialReportOuv[];
  aged: Record<AgeRangeId, CommercialReportOuv[]>;
  openOuvs: CommercialReportOuv[];
};

export function reportOfKind(kind: CommercialReportKind): CommercialReportName {
  return (PIPELINE_DETAIL_KINDS as readonly string[]).includes(kind)
    ? 'pipeline-health'
    : 'committee';
}

/** JSON text from audit_log. The literal `null` stays null, including a real 0. */
export function parseAuditAmount(
  raw: string | null | undefined,
): number | null {
  if (raw == null || raw.trim() === '') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (parsed == null) return null;
  if (typeof parsed === 'number') {
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof parsed === 'string' && parsed.trim() !== '') {
    const value = Number(parsed);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

export function isSyntheticMetadata(metadata: unknown): boolean {
  let record = metadata;
  if (typeof metadata === 'string') {
    try {
      record = JSON.parse(metadata) as unknown;
    } catch {
      return false;
    }
  }
  if (typeof record !== 'object' || record == null) return false;
  return (record as { synthetic_entry?: unknown }).synthetic_entry === true;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundDays(value: number): number {
  return Math.round(value * 10) / 10;
}

function sumAmounts(items: { monto: number | null }[]): number {
  return sumRounded(items.map((item) => item.monto ?? 0));
}

function sumRounded(values: number[]): number {
  const cents = values.reduce((sum, value) => sum + Math.round(value * 100), 0);
  return cents / 100;
}

function inclusiveEndYmd(exclusiveEnd: Date): string {
  return addBogotaCalendarDays(bogotaYmd(exclusiveEnd), -1);
}

function inWindow(date: Date | null, range: HalfOpenRange | null): boolean {
  if (!range) return true;
  if (!date || Number.isNaN(date.getTime())) return false;
  const time = date.getTime();
  return time >= range.start.getTime() && time < range.end.getTime();
}

function dateOnlyInstant(ymd: string | null): Date | null {
  if (!ymd) return null;
  const day = ymd.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return bogotaDayStartFromYmd(day);
}

function ageDays(createdAt: Date, now: Date): number {
  return bogotaCalendarDaysBetween(createdAt, now);
}

function ageRangeOf(days: number): AgeRangeId | null {
  if (days > 365 && days <= 730) return '1_2';
  if (days > 730 && days <= 1095) return '2_3';
  if (days > 1095) return 'over_3';
  return null;
}

/** Ganada uses monto_final, Perdida uses the dashboard lost amount, the rest presupuesto. */
export function currentAmount(row: OuvDashboardSourceRow): number {
  if (row.resultado === 'Ganada') return row.montoFinal;
  if (row.resultado === 'Perdida') return lostAmount(row);
  return row.presupuestoMonto;
}

function stageBucket(trigger: string): StageBucket | null {
  switch (trigger) {
    case 'ADVANCE':
      return 'advance';
    case 'RETREAT':
      return 'retreat';
    case 'WIN':
    case 'LOSS':
    case 'DISCARD':
      return 'closure';
    case 'MANUAL':
      return 'reopening';
    default:
      return null;
  }
}

function mobilizationWindow(
  fechaCorte: string | undefined,
  now: Date,
): { range: HalfOpenRange; fechaCorte: string; asOf: string } {
  const asOf = bogotaYmd(now);
  const corte = fechaCorte?.slice(0, 10) || addBogotaCalendarDays(asOf, -7);
  return {
    fechaCorte: corte,
    asOf,
    range: {
      start: bogotaDayStartFromYmd(corte),
      end: bogotaDayStartFromYmd(addBogotaCalendarDays(asOf, 1)),
    },
  };
}

function emptyStages(): Record<StageBucket, LinkedStage[]> {
  return { advance: [], retreat: [], closure: [], reopening: [] };
}

function collect(input: CommercialReportInput): Collected {
  const resolved = resolveOuvDashboardPeriod(input.period);
  const period = resolved.current;
  const window = mobilizationWindow(input.fechaCorte, input.now);
  const byId = new Map(input.ouvs.map((ouv) => [ouv.ouvId, ouv]));

  const history = input.history.filter((row) => byId.has(row.ouvId));
  const excluded = new Set<string>();
  for (const row of history) {
    if (!row.synthetic) continue;
    const inPeriod = inWindow(row.changedAt, period);
    const inMobilization = inWindow(row.changedAt, window.range);
    if (inPeriod || inMobilization) excluded.add(row.historyId);
  }

  const stagesInPeriod = emptyStages();
  const zoneInWindow: LinkedStage[] = [];
  for (const row of history) {
    if (row.synthetic) continue;
    const bucket = stageBucket(row.trigger);
    if (!bucket) continue;
    const ouv = byId.get(row.ouvId);
    if (!ouv) continue;
    const linked: LinkedStage = {
      ouv,
      fromEstado: row.fromEstado,
      toEstado: row.toEstado,
      changedAt: row.changedAt,
      changedBy: row.changedBy,
      bucket,
    };
    if (inWindow(row.changedAt, period)) stagesInPeriod[bucket].push(linked);
    if (
      (row.trigger === 'ADVANCE' || row.trigger === 'RETREAT') &&
      inWindow(row.changedAt, window.range)
    ) {
      zoneInWindow.push(linked);
    }
  }

  const amountsInWindow = input.amountChanges
    .filter(
      (row) =>
        byId.has(row.ouvId) &&
        (COMMERCIAL_REPORT_AMOUNT_FIELDS as readonly string[]).includes(
          row.campo,
        ) &&
        inWindow(row.changedAt, window.range),
    )
    .map((row) => ({
      ouv: byId.get(row.ouvId) as CommercialReportOuv,
      campo: row.campo,
      previousAmount: row.previousAmount,
      newAmount: row.newAmount,
      changedAt: row.changedAt,
      changedBy: row.changedBy,
    }));

  const newInWindow = input.ouvs.filter((ouv) =>
    inWindow(ouv.createdAt, window.range),
  );
  const wonInWindow = input.ouvs.filter((ouv) =>
    isWonInPeriod(ouv, window.range),
  );
  const lostInWindow = input.ouvs.filter((ouv) =>
    isLostInPeriod(ouv, window.range),
  );
  const mobilizedIds = new Set<string>([
    ...newInWindow.map((ouv) => ouv.ouvId),
    ...zoneInWindow.map((row) => row.ouv.ouvId),
    ...amountsInWindow.map((row) => row.ouv.ouvId),
    ...wonInWindow.map((ouv) => ouv.ouvId),
    ...lostInWindow.map((ouv) => ouv.ouvId),
  ]);

  const newInPeriod = input.ouvs.filter((ouv) =>
    inWindow(ouv.createdAt, period),
  );
  const funnel = input.ouvs.filter((ouv) =>
    inWindow(dateOnlyInstant(ouv.expectedCloseDate), period),
  );
  const funnelCreated = funnel.filter((ouv) => inWindow(ouv.createdAt, period));
  const missingClose = input.ouvs.filter(
    (ouv) => isDashboardOpen(ouv) && !ouv.expectedCloseDate,
  );
  const openOuvs = input.ouvs.filter((ouv) => isDashboardOpen(ouv));
  const aged: Record<AgeRangeId, CommercialReportOuv[]> = {
    '1_2': [],
    '2_3': [],
    over_3: [],
  };
  for (const ouv of openOuvs) {
    const range = ageRangeOf(ageDays(ouv.createdAt, input.now));
    if (range) aged[range].push(ouv);
  }

  return {
    period,
    periodMeta: {
      period_from: period ? bogotaYmd(period.start) : null,
      period_to: period ? inclusiveEndYmd(period.end) : null,
      year: resolved.year,
      quarter: resolved.quarter,
    },
    mobilization: window.range,
    fechaCorte: window.fechaCorte,
    asOf: window.asOf,
    excludedSynthetic: excluded.size,
    newInWindow,
    zoneInWindow,
    amountsInWindow,
    wonInWindow,
    lostInWindow,
    mobilized: input.ouvs.filter((ouv) => mobilizedIds.has(ouv.ouvId)),
    stagesInPeriod,
    newInPeriod,
    funnel,
    funnelCreated,
    missingClose,
    aged,
    openOuvs,
  };
}

function blankChange(): Pick<
  CommercialReportDetailItem,
  | 'from_estado'
  | 'to_estado'
  | 'changed_at'
  | 'changed_by'
  | 'previous_amount'
  | 'new_amount'
  | 'campo'
> {
  return {
    from_estado: null,
    to_estado: null,
    changed_at: null,
    changed_by: null,
    previous_amount: null,
    new_amount: null,
    campo: null,
  };
}

function ouvItem(
  ouv: CommercialReportOuv,
  monto: number | null,
  fecha: string | null,
): CommercialReportDetailItem {
  return {
    ouv_id: ouv.ouvId,
    consecutivo: ouv.consecutivo,
    titulo: ouv.titulo,
    empresa: ouv.empresaNombre,
    comercial: ouv.comercialName,
    segmento: ouv.segmento,
    zona: ouv.zonaActual,
    monto,
    fecha,
    ...blankChange(),
  };
}

function byConsecutivo(
  left: CommercialReportDetailItem,
  right: CommercialReportDetailItem,
): number {
  return (
    left.consecutivo.localeCompare(right.consecutivo, 'es') ||
    left.ouv_id.localeCompare(right.ouv_id)
  );
}

function byChangedAt(
  left: CommercialReportDetailItem,
  right: CommercialReportDetailItem,
): number {
  return (
    (left.changed_at ?? '').localeCompare(right.changed_at ?? '') ||
    byConsecutivo(left, right)
  );
}

function stageItems(events: LinkedStage[]): CommercialReportDetailItem[] {
  return events
    .map((event) => ({
      ...ouvItem(
        event.ouv,
        roundMoney(currentAmount(event.ouv)),
        event.changedAt.toISOString(),
      ),
      from_estado: event.fromEstado,
      to_estado: event.toEstado,
      changed_at: event.changedAt.toISOString(),
      changed_by: event.changedBy,
    }))
    .sort(byChangedAt);
}

function applyStageFilter(
  items: CommercialReportDetailItem[],
  filters: CommercialReportDetailFilters,
): CommercialReportDetailItem[] {
  return items.filter((item) => {
    if (filters.fromEstado && item.from_estado !== filters.fromEstado) {
      return false;
    }
    if (filters.toEstado && item.to_estado !== filters.toEstado) return false;
    return true;
  });
}

function amountItems(events: LinkedAmount[]): CommercialReportDetailItem[] {
  return events
    .map((event) => ({
      ...ouvItem(
        event.ouv,
        event.newAmount == null ? null : roundMoney(event.newAmount),
        event.changedAt.toISOString(),
      ),
      changed_at: event.changedAt.toISOString(),
      changed_by: event.changedBy,
      previous_amount:
        event.previousAmount == null ? null : roundMoney(event.previousAmount),
      new_amount: event.newAmount == null ? null : roundMoney(event.newAmount),
      campo: event.campo,
    }))
    .sort(byChangedAt);
}

function ouvItems(
  ouvs: CommercialReportOuv[],
  montoOf: (ouv: CommercialReportOuv) => number,
  fechaOf: (ouv: CommercialReportOuv) => string | null,
): CommercialReportDetailItem[] {
  return ouvs
    .map((ouv) => ouvItem(ouv, roundMoney(montoOf(ouv)), fechaOf(ouv)))
    .sort(byConsecutivo);
}

function presupuestoOf(ouv: CommercialReportOuv): number {
  return ouv.presupuestoMonto;
}

function createdFecha(ouv: CommercialReportOuv): string {
  return ouv.createdAt.toISOString();
}

function closeFecha(ouv: CommercialReportOuv): string | null {
  return ouv.fechaCierre ? ouv.fechaCierre.toISOString() : null;
}

function blockFromOuvs(
  ouvs: CommercialReportOuv[],
  montoOf: (ouv: CommercialReportOuv) => number,
): MobilizationBlock {
  const items = ouvItems(ouvs, montoOf, createdFecha);
  return {
    ouv_count: ouvs.length,
    event_count: ouvs.length,
    amount: sumAmounts(items),
  };
}

function blockFromEvents(
  ouvIds: string[],
  items: CommercialReportDetailItem[],
): MobilizationBlock {
  return {
    ouv_count: new Set(ouvIds).size,
    event_count: items.length,
    amount: sumAmounts(items),
  };
}

function distinctOuvFigures(items: CommercialReportDetailItem[]): {
  ouv_count: number;
  ouv_amount: number;
} {
  const seen = new Set<string>();
  const firstItems: CommercialReportDetailItem[] = [];
  for (const item of items) {
    if (seen.has(item.ouv_id)) continue;
    seen.add(item.ouv_id);
    firstItems.push(item);
  }
  return { ouv_count: firstItems.length, ouv_amount: sumAmounts(firstItems) };
}

function cellsFromItems(items: CommercialReportDetailItem[]): StageCell[] {
  const groups = new Map<string, CommercialReportDetailItem[]>();
  for (const item of items) {
    const key = `${item.from_estado ?? ''}\0${item.to_estado ?? ''}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({
      from_estado: group[0].from_estado,
      to_estado: group[0].to_estado ?? '',
      event_count: group.length,
      event_amount: sumAmounts(group),
      ...distinctOuvFigures(group),
    }))
    .sort(
      (left, right) =>
        (left.from_estado ?? '').localeCompare(right.from_estado ?? '', 'es') ||
        left.to_estado.localeCompare(right.to_estado, 'es'),
    );
}

function stageBlock(events: LinkedStage[]): StageBlock {
  const items = stageItems(events);
  return {
    event_count: items.length,
    event_amount: sumAmounts(items),
    ...distinctOuvFigures(items),
    cells: cellsFromItems(items),
  };
}

function countAmount(
  ouvs: CommercialReportOuv[],
  montoOf: (ouv: CommercialReportOuv) => number,
): CountAmount {
  const items = ouvItems(ouvs, montoOf, createdFecha);
  return { count: ouvs.length, amount: sumAmounts(items) };
}

function rangeRows(
  groups: Map<string, Map<AgeRangeId, CommercialReportOuv[]>>,
): { range: AgeRangeId; count: number; amount: number }[] {
  return AGE_RANGES.map(({ range }) => {
    const ouvs = [...groups.values()].flatMap(
      (bucket) => bucket.get(range) ?? [],
    );
    return {
      range,
      count: ouvs.length,
      amount: countAmount(ouvs, currentAmount).amount,
    };
  }).filter((row) => row.count > 0);
}

export function buildCommitteeReport(
  input: CommercialReportInput,
): CommitteeReport {
  const data = collect(input);
  const zoneItems = stageItems(data.zoneInWindow);
  const amountItemsInWindow = amountItems(data.amountsInWindow);
  const mobilizedItems = ouvItems(data.mobilized, currentAmount, createdFecha);
  const eventCount =
    data.newInWindow.length +
    zoneItems.length +
    amountItemsInWindow.length +
    data.wonInWindow.length +
    data.lostInWindow.length;

  const newItems = ouvItems(data.newInPeriod, presupuestoOf, createdFecha);
  const segmentNew = new Map<string, CommercialReportDetailItem[]>();
  const commercialNew = new Map<
    string,
    { full_name: string; items: CommercialReportDetailItem[] }
  >();
  for (const item of newItems) {
    const ouv = data.newInPeriod.find((row) => row.ouvId === item.ouv_id);
    const segment = segmentNew.get(item.segmento) ?? [];
    segment.push(item);
    segmentNew.set(item.segmento, segment);
    const commercial = commercialNew.get(ouv?.comercialId ?? item.ouv_id) ?? {
      full_name: item.comercial,
      items: [],
    };
    commercial.items.push(item);
    commercialNew.set(ouv?.comercialId ?? item.ouv_id, commercial);
  }

  const funnelItems = ouvItems(
    data.funnel,
    currentAmount,
    (ouv) => ouv.expectedCloseDate,
  );
  const createdIds = new Set(data.funnelCreated.map((ouv) => ouv.ouvId));
  const byResultado = new Map<string, CommercialReportDetailItem[]>();
  for (const item of funnelItems) {
    const ouv = data.funnel.find((row) => row.ouvId === item.ouv_id);
    const key = ouv?.resultado ?? '';
    const bucket = byResultado.get(key) ?? [];
    bucket.push(item);
    byResultado.set(key, bucket);
  }

  return {
    period: data.periodMeta,
    fecha_corte: data.fechaCorte,
    as_of: data.asOf,
    excluded_synthetic: data.excludedSynthetic,
    m003: {
      mobilized: {
        ouv_count: data.mobilized.length,
        event_count: eventCount,
        amount: sumAmounts(mobilizedItems),
      },
      new_ouvs: blockFromOuvs(data.newInWindow, presupuestoOf),
      zone_changes: blockFromEvents(
        data.zoneInWindow.map((row) => row.ouv.ouvId),
        zoneItems,
      ),
      amount_changes: blockFromEvents(
        data.amountsInWindow.map((row) => row.ouv.ouvId),
        amountItemsInWindow,
      ),
      won: blockFromOuvs(data.wonInWindow, (ouv) => ouv.montoFinal),
      lost: blockFromOuvs(data.lostInWindow, lostAmount),
    },
    m035: {
      advances: stageBlock(data.stagesInPeriod.advance),
      retreats: stageBlock(data.stagesInPeriod.retreat),
      closures: stageBlock(data.stagesInPeriod.closure),
      reopenings: stageBlock(data.stagesInPeriod.reopening),
    },
    m025: {
      by_segment: [...segmentNew.entries()]
        .map(([segmento, items]) => ({
          segmento,
          count: items.length,
          amount: sumAmounts(items),
        }))
        .sort((left, right) =>
          left.segmento.localeCompare(right.segmento, 'es'),
        ),
      by_commercial: [...commercialNew.entries()]
        .map(([userId, value]) => ({
          user_id: userId,
          full_name: value.full_name,
          count: value.items.length,
          amount: sumAmounts(value.items),
        }))
        .sort(
          (left, right) =>
            left.full_name.localeCompare(right.full_name, 'es') ||
            left.user_id.localeCompare(right.user_id),
        ),
    },
    m013: {
      by_resultado: [...byResultado.entries()]
        .map(([resultado, items]) => {
          const created = items.filter((item) => createdIds.has(item.ouv_id));
          return {
            resultado,
            count: items.length,
            amount: sumAmounts(items),
            created_in_period: created.length,
            created_in_period_amount: sumAmounts(created),
          };
        })
        .sort(
          (left, right) =>
            RESULTADO_ORDER.indexOf(left.resultado) -
              RESULTADO_ORDER.indexOf(right.resultado) ||
            left.resultado.localeCompare(right.resultado, 'es'),
        ),
      created_in_period: countAmount(data.funnelCreated, currentAmount),
      missing_expected_close: countAmount(data.missingClose, currentAmount),
    },
  };
}

export function buildPipelineHealth(
  input: CommercialReportInput,
): PipelineHealthReport {
  const data = collect(input);
  const bySegment = new Map<string, Map<AgeRangeId, CommercialReportOuv[]>>();
  const byCommercial = new Map<
    string,
    { full_name: string; ranges: Map<AgeRangeId, CommercialReportOuv[]> }
  >();
  for (const range of AGE_RANGES) {
    for (const ouv of data.aged[range.range]) {
      const segment =
        bySegment.get(ouv.segmento) ??
        new Map<AgeRangeId, CommercialReportOuv[]>();
      const segmentBucket = segment.get(range.range) ?? [];
      segmentBucket.push(ouv);
      segment.set(range.range, segmentBucket);
      bySegment.set(ouv.segmento, segment);
      const commercial = byCommercial.get(ouv.comercialId) ?? {
        full_name: ouv.comercialName,
        ranges: new Map<AgeRangeId, CommercialReportOuv[]>(),
      };
      const commercialBucket = commercial.ranges.get(range.range) ?? [];
      commercialBucket.push(ouv);
      commercial.ranges.set(range.range, commercialBucket);
      byCommercial.set(ouv.comercialId, commercial);
    }
  }

  const ageBySegment = new Map<string, { days: number[]; cents: number }>();
  for (const ouv of data.openOuvs) {
    const bucket = ageBySegment.get(ouv.segmento) ?? { days: [], cents: 0 };
    bucket.days.push(ageDays(ouv.createdAt, input.now));
    bucket.cents += Math.round(currentAmount(ouv) * 100);
    ageBySegment.set(ouv.segmento, bucket);
  }

  return {
    as_of: data.asOf,
    m023: {
      ranges: AGE_RANGES.map(({ range, label }) => ({
        range,
        label,
        ...countAmount(data.aged[range], currentAmount),
      })),
      by_segment: [...bySegment.entries()]
        .map(([segmento, ranges]) => ({
          segmento,
          ranges: rangeRows(new Map([[segmento, ranges]])),
        }))
        .sort((left, right) =>
          left.segmento.localeCompare(right.segmento, 'es'),
        ),
      by_commercial: [...byCommercial.entries()]
        .map(([userId, value]) => ({
          user_id: userId,
          full_name: value.full_name,
          ranges: rangeRows(new Map([[userId, value.ranges]])),
        }))
        .sort(
          (left, right) =>
            left.full_name.localeCompare(right.full_name, 'es') ||
            left.user_id.localeCompare(right.user_id),
        ),
    },
    average_age: {
      by_segment: [...ageBySegment.entries()]
        .map(([segmento, value]) => ({
          segmento,
          count: value.days.length,
          amount: value.cents / 100,
          avg_days: roundDays(
            value.days.reduce((sum, days) => sum + days, 0) / value.days.length,
          ),
        }))
        .sort((left, right) =>
          left.segmento.localeCompare(right.segmento, 'es'),
        ),
    },
  };
}

function agedItems(data: Collected, range: AgeRangeId | null) {
  const ouvs = range
    ? data.aged[range]
    : [...data.aged['1_2'], ...data.aged['2_3'], ...data.aged.over_3];
  return ouvItems(ouvs, currentAmount, createdFecha);
}

export function listCommercialReportDetails(
  input: CommercialReportInput,
  kind: CommercialReportKind,
  filters: CommercialReportDetailFilters = {},
): {
  items: CommercialReportDetailItem[];
  total: number;
  amount_total: number;
  ouv_count: number;
  ouv_amount: number;
} {
  const data = collect(input);
  let items: CommercialReportDetailItem[];
  switch (kind) {
    case 'm003_new':
      items = ouvItems(data.newInWindow, presupuestoOf, createdFecha);
      break;
    case 'm003_zone_changes':
      items = stageItems(data.zoneInWindow);
      break;
    case 'm003_amount_changes':
      items = amountItems(data.amountsInWindow);
      break;
    case 'm003_won':
      items = ouvItems(data.wonInWindow, (ouv) => ouv.montoFinal, closeFecha);
      break;
    case 'm003_lost':
      items = ouvItems(data.lostInWindow, lostAmount, closeFecha);
      break;
    case 'm003_mobilized':
      items = ouvItems(data.mobilized, currentAmount, createdFecha);
      break;
    case 'm035_advances':
      items = applyStageFilter(
        stageItems(data.stagesInPeriod.advance),
        filters,
      );
      break;
    case 'm035_retreats':
      items = applyStageFilter(
        stageItems(data.stagesInPeriod.retreat),
        filters,
      );
      break;
    case 'm035_closures':
      items = applyStageFilter(
        stageItems(data.stagesInPeriod.closure),
        filters,
      );
      break;
    case 'm035_reopenings':
      items = applyStageFilter(
        stageItems(data.stagesInPeriod.reopening),
        filters,
      );
      break;
    case 'm025_new':
      items = ouvItems(data.newInPeriod, presupuestoOf, createdFecha);
      break;
    case 'm013_expected_close':
      items = ouvItems(
        data.funnel.filter(
          (ouv) => !filters.resultado || ouv.resultado === filters.resultado,
        ),
        currentAmount,
        (ouv) => ouv.expectedCloseDate,
      );
      break;
    case 'm013_created_in_period':
      items = ouvItems(
        data.funnelCreated.filter(
          (ouv) => !filters.resultado || ouv.resultado === filters.resultado,
        ),
        currentAmount,
        (ouv) => ouv.expectedCloseDate,
      );
      break;
    case 'm013_missing_close':
      items = ouvItems(data.missingClose, currentAmount, createdFecha);
      break;
    case 'm023_1_2':
      items = agedItems(data, '1_2');
      break;
    case 'm023_2_3':
      items = agedItems(data, '2_3');
      break;
    case 'm023_over_3':
      items = agedItems(data, 'over_3');
      break;
    case 'm023_aged':
      items = agedItems(data, null);
      break;
    case 'open_average_age':
      items = ouvItems(data.openOuvs, currentAmount, createdFecha);
      break;
    default:
      items = [];
  }
  const distinct = distinctOuvFigures(items);
  return {
    items,
    total: items.length,
    amount_total: sumAmounts(items),
    ouv_count: distinct.ouv_count,
    ouv_amount: distinct.ouv_amount,
  };
}

export function aggregateForKind(
  committee: CommitteeReport,
  health: PipelineHealthReport,
  kind: CommercialReportKind,
): { total: number; amount: number } {
  switch (kind) {
    case 'm003_new':
      return {
        total: committee.m003.new_ouvs.event_count,
        amount: committee.m003.new_ouvs.amount,
      };
    case 'm003_zone_changes':
      return {
        total: committee.m003.zone_changes.event_count,
        amount: committee.m003.zone_changes.amount,
      };
    case 'm003_amount_changes':
      return {
        total: committee.m003.amount_changes.event_count,
        amount: committee.m003.amount_changes.amount,
      };
    case 'm003_won':
      return {
        total: committee.m003.won.event_count,
        amount: committee.m003.won.amount,
      };
    case 'm003_lost':
      return {
        total: committee.m003.lost.event_count,
        amount: committee.m003.lost.amount,
      };
    case 'm003_mobilized':
      return {
        total: committee.m003.mobilized.ouv_count,
        amount: committee.m003.mobilized.amount,
      };
    case 'm035_advances':
      return {
        total: committee.m035.advances.event_count,
        amount: committee.m035.advances.event_amount,
      };
    case 'm035_retreats':
      return {
        total: committee.m035.retreats.event_count,
        amount: committee.m035.retreats.event_amount,
      };
    case 'm035_closures':
      return {
        total: committee.m035.closures.event_count,
        amount: committee.m035.closures.event_amount,
      };
    case 'm035_reopenings':
      return {
        total: committee.m035.reopenings.event_count,
        amount: committee.m035.reopenings.event_amount,
      };
    case 'm025_new':
      return {
        total: committee.m025.by_segment.reduce(
          (sum, row) => sum + row.count,
          0,
        ),
        amount: sumRounded(committee.m025.by_segment.map((row) => row.amount)),
      };
    case 'm013_expected_close':
      return {
        total: committee.m013.by_resultado.reduce(
          (sum, row) => sum + row.count,
          0,
        ),
        amount: sumRounded(
          committee.m013.by_resultado.map((row) => row.amount),
        ),
      };
    case 'm013_created_in_period':
      return {
        total: committee.m013.created_in_period.count,
        amount: committee.m013.created_in_period.amount,
      };
    case 'm013_missing_close':
      return {
        total: committee.m013.missing_expected_close.count,
        amount: committee.m013.missing_expected_close.amount,
      };
    case 'm023_1_2':
    case 'm023_2_3':
    case 'm023_over_3': {
      const range = health.m023.ranges.find(
        (row) => row.range === kind.slice(5),
      );
      return { total: range?.count ?? 0, amount: range?.amount ?? 0 };
    }
    case 'm023_aged':
      return {
        total: health.m023.ranges.reduce((sum, row) => sum + row.count, 0),
        amount: sumRounded(health.m023.ranges.map((row) => row.amount)),
      };
    case 'open_average_age':
      return {
        total: health.average_age.by_segment.reduce(
          (sum, row) => sum + row.count,
          0,
        ),
        amount: sumRounded(
          health.average_age.by_segment.map((row) => row.amount),
        ),
      };
    default:
      return { total: 0, amount: 0 };
  }
}
