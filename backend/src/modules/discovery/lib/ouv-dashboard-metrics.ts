import {
  addBogotaCalendarDays,
  bogotaDayStartFromYmd,
  bogotaYmd,
} from '../../../common/time/bogota-day';
import { verytelFiscalPeriod } from '../../../common/time/verytel-quarter';

/**
 * Commercial OUV dashboard math.
 *
 * The existing open pipeline at an instant T is reconstructed from
 * created_at and fecha_cierre. Funnel conversion assumes a linear zone path
 * and treats Ganada as having passed every zone.
 *
 * The added segment breakdown counts resultado EnCurso as open. Won and lost
 * stay on fecha_cierre inside the period, same as closeStats. Amount win rate
 * divides won monto_final by won monto_final plus lostAmount.
 *
 * Weighted pipeline uses a fixed probability per zone. OUVs do not store
 * their own win probability, and there is no sales-quota table, so the
 * dashboard does not invent a target.
 */

export const OUV_DASHBOARD_ZONES = [
  'UNIVERSO',
  'ENCIMA_FUNNEL',
  'EN_FUNNEL',
  'MAYOR_PROBABILIDAD',
] as const;

export type OuvDashboardZone = (typeof OUV_DASHBOARD_ZONES)[number];

export const OUV_DASHBOARD_ZONE_LABEL: Record<OuvDashboardZone, string> = {
  UNIVERSO: 'Universo',
  ENCIMA_FUNNEL: 'Encima Funnel',
  EN_FUNNEL: 'En Funnel',
  MAYOR_PROBABILIDAD: 'Mayor Probabilidad',
};

/** Probability applied to presupuesto while the OUV sits in that zone. */
export const OUV_DASHBOARD_ZONE_WEIGHT: Record<OuvDashboardZone, number> = {
  UNIVERSO: 0.1,
  ENCIMA_FUNNEL: 0.25,
  EN_FUNNEL: 0.5,
  MAYOR_PROBABILIDAD: 0.75,
};

export const OUV_DASHBOARD_STALE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export type OuvDashboardSourceRow = {
  ouvId: string;
  consecutivo: string;
  titulo: string;
  comercialId: string;
  comercialName: string;
  segmento: string;
  zonaActual: string;
  resultado: string;
  presupuestoMonto: number;
  montoFinal: number;
  montoPerdido: number;
  fechaCierre: Date | null;
  createdAt: Date;
  updatedAt: Date;
  origin: string | null;
  origenVia: string;
  motivoSnapshot: string | null;
  empresaNombre: string;
  presupuestoMoneda: string | null;
  monedaFinal: string | null;
};

export type OuvDashboardPeriodInput = {
  year?: number;
  quarter?: number;
  periodFrom?: string;
  periodTo?: string;
};

type HalfOpenRange = { start: Date; end: Date };

export type OuvDashboardMetrics = {
  period: {
    active: boolean;
    period_from: string | null;
    period_to: string | null;
    year: number | null;
    quarter: number | null;
    compare_from: string | null;
    compare_to: string | null;
  };
  pipeline_weighted: {
    amount: number;
    open_amount: number;
    weight_share: number | null;
    weights: { zona: OuvDashboardZone; label: string; weight: number }[];
  };
  pipeline_value: {
    amount: number;
    count: number;
    delta_ratio: number | null;
  };
  close_rate: {
    rate: number | null;
    rate_amount: number | null;
    delta_points: number | null;
    won_count: number;
    lost_count: number;
  };
  sales_cycle: {
    avg_days: number | null;
    by_segment: { segmento: string; avg_days: number; count: number }[];
  };
  new_ouvs: { count: number; amount: number };
  funnel: {
    zona: OuvDashboardZone;
    label: string;
    amount: number;
    count: number;
    conversion_to_next: number | null;
    next_label: string;
  }[];
  bottleneck: {
    from_label: string;
    to_label: string;
    rate: number;
  } | null;
  won_vs_lost: {
    won: { count: number; amount: number };
    lost: { count: number; amount: number };
    loss_reasons: { label: string; count: number; share: number }[];
  };
  pipeline_by_sector: {
    segmento: string;
    amount: number;
    open_count: number;
    open_amount_now: number;
    share: number;
    win_rate: number | null;
    win_rate_amount: number | null;
  }[];
  new_origins: { label: string; count: number }[];
  executives: {
    user_id: string;
    full_name: string;
    open_count: number;
    pipeline_amount: number;
    open_count_now: number;
    open_amount_now: number;
    win_rate: number | null;
    win_rate_amount: number | null;
    won_amount: number;
  }[];
  by_segment: {
    segmento: string;
    open_count: number;
    open_amount: number;
    won_count: number;
    won_amount: number;
    lost_count: number;
    lost_amount: number;
    win_rate: number | null;
    win_rate_amount: number | null;
  }[];
  mayor_probabilidad_by_segment: {
    segmento: string;
    count: number;
    amount: number;
  }[];
  stalled: {
    ouv_id: string;
    consecutivo: string;
    titulo: string;
    zona: string;
    amount: number;
    days_stale: number;
    comercial_name: string;
  }[];
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundRatio(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function inclusiveEndYmd(exclusiveEnd: Date): string {
  return addBogotaCalendarDays(bogotaYmd(exclusiveEnd), -1);
}

export function resolveOuvDashboardPeriod(input: OuvDashboardPeriodInput): {
  current: HalfOpenRange | null;
  previous: HalfOpenRange | null;
  year: number | null;
  quarter: number | null;
} {
  const custom = Boolean(input.periodFrom && input.periodTo);
  let current: HalfOpenRange | null = null;
  let year: number | null = null;
  let quarter: number | null = null;

  if (custom) {
    const start = bogotaDayStartFromYmd(input.periodFrom!);
    const end = bogotaDayStartFromYmd(
      addBogotaCalendarDays(input.periodTo!, 1),
    );
    if (end.getTime() > start.getTime()) {
      current = { start, end };
    }
  } else if (input.year != null && input.quarter != null) {
    year = input.year;
    quarter = input.quarter;
    const fiscalQuarter =
      input.quarter === 1 ||
      input.quarter === 2 ||
      input.quarter === 3 ||
      input.quarter === 4
        ? input.quarter
        : null;
    if (fiscalQuarter) {
      current = verytelFiscalPeriod(input.year, fiscalQuarter);
    }
  } else if (input.year != null) {
    year = input.year;
    current = verytelFiscalPeriod(input.year);
  }

  if (!current) {
    return { current: null, previous: null, year, quarter };
  }

  const length = current.end.getTime() - current.start.getTime();
  return {
    current,
    previous: {
      start: new Date(current.start.getTime() - length),
      end: current.start,
    },
    year,
    quarter,
  };
}

function inRange(date: Date | null, range: HalfOpenRange | null): boolean {
  if (!range) return true;
  if (!date) return false;
  const time = date.getTime();
  return time >= range.start.getTime() && time < range.end.getTime();
}

/** Open for the new segment breakdown and its detail. Descartada is excluded. */
export function isDashboardOpen(row: OuvDashboardSourceRow): boolean {
  return row.resultado === 'EnCurso';
}

export function isWonInPeriod(
  row: OuvDashboardSourceRow,
  range: HalfOpenRange | null,
): boolean {
  return row.resultado === 'Ganada' && inRange(row.fechaCierre, range);
}

export function isLostInPeriod(
  row: OuvDashboardSourceRow,
  range: HalfOpenRange | null,
): boolean {
  return row.resultado === 'Perdida' && inRange(row.fechaCierre, range);
}

export function isMayorProbabilidadAbierta(
  row: OuvDashboardSourceRow,
): boolean {
  return isDashboardOpen(row) && row.zonaActual === 'MAYOR_PROBABILIDAD';
}

function isOpenAt(row: OuvDashboardSourceRow, instant: Date): boolean {
  if (row.createdAt.getTime() >= instant.getTime()) return false;
  if (row.resultado === 'EnCurso') return true;
  if (!row.fechaCierre) return false;
  return row.fechaCierre.getTime() >= instant.getTime();
}

function zoneOf(value: string): OuvDashboardZone | null {
  return (OUV_DASHBOARD_ZONES as readonly string[]).includes(value)
    ? (value as OuvDashboardZone)
    : null;
}

function rankReached(row: OuvDashboardSourceRow): number {
  if (row.resultado === 'Ganada') return OUV_DASHBOARD_ZONES.length;
  const index = OUV_DASHBOARD_ZONES.indexOf(row.zonaActual as OuvDashboardZone);
  return index < 0 ? 0 : index;
}

/** Same lost-money rule the board already uses for won-vs-lost. */
export function lostAmount(row: OuvDashboardSourceRow): number {
  return row.montoPerdido > 0 ? row.montoPerdido : row.presupuestoMonto;
}

export function amountWinRate(won: number, lost: number): number | null {
  const decided = won + lost;
  return decided > 0 ? roundRatio(won / decided) : null;
}

function originLabel(row: OuvDashboardSourceRow): string {
  const origin = row.origin?.trim();
  if (origin) return origin;
  if (row.origenVia === 'desde_sql') return 'Desde SQL';
  if (row.origenVia === 'directa') return 'Directa';
  return 'Sin origen';
}

function closeStats(
  rows: OuvDashboardSourceRow[],
  range: HalfOpenRange | null,
) {
  let won = 0;
  let lost = 0;
  for (const row of rows) {
    if (isWonInPeriod(row, range)) won += 1;
    else if (isLostInPeriod(row, range)) lost += 1;
  }
  const decided = won + lost;
  return {
    won,
    lost,
    rate: decided > 0 ? won / decided : null,
  };
}

function pipelineAt(rows: OuvDashboardSourceRow[], instant: Date) {
  let amount = 0;
  let count = 0;
  let weighted = 0;
  for (const row of rows) {
    if (!isOpenAt(row, instant)) continue;
    count += 1;
    amount += row.presupuestoMonto;
    const zone = zoneOf(row.zonaActual);
    if (zone)
      weighted += row.presupuestoMonto * OUV_DASHBOARD_ZONE_WEIGHT[zone];
  }
  return { amount, count, weighted };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildOuvDashboard(
  rows: OuvDashboardSourceRow[],
  input: OuvDashboardPeriodInput,
  now: Date,
): OuvDashboardMetrics {
  const resolved = resolveOuvDashboardPeriod(input);
  const period = resolved.current;
  const previous = resolved.previous;
  const snapshotAt =
    period && period.end.getTime() < now.getTime() ? period.end : now;

  const openNow = pipelineAt(rows, snapshotAt);
  const openPrevious =
    period && previous ? pipelineAt(rows, period.start) : null;

  const currentClose = closeStats(rows, period);
  const previousClose = previous ? closeStats(rows, previous) : null;

  const cycleDays: number[] = [];
  const cycleBySegment = new Map<string, number[]>();
  let newCount = 0;
  let newAmount = 0;
  const origins = new Map<string, number>();
  let wonAmount = 0;
  let lostAmountSum = 0;
  const reasons = new Map<string, number>();

  for (const row of rows) {
    if (inRange(row.createdAt, period)) {
      newCount += 1;
      newAmount += row.presupuestoMonto;
      const label = originLabel(row);
      origins.set(label, (origins.get(label) ?? 0) + 1);
    }

    if (isWonInPeriod(row, period)) {
      wonAmount += row.montoFinal;
      if (row.fechaCierre) {
        const days =
          (row.fechaCierre.getTime() - row.createdAt.getTime()) / DAY_MS;
        if (days >= 0) {
          cycleDays.push(days);
          const bucket = cycleBySegment.get(row.segmento) ?? [];
          bucket.push(days);
          cycleBySegment.set(row.segmento, bucket);
        }
      }
    } else if (isLostInPeriod(row, period)) {
      lostAmountSum += lostAmount(row);
      const reason = row.motivoSnapshot?.trim() || 'Sin motivo';
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
  }

  const cohort = period
    ? rows.filter((row) => inRange(row.createdAt, period))
    : rows;

  const funnel = OUV_DASHBOARD_ZONES.map((zona, index) => {
    const openInZone = rows.filter(
      (row) => isOpenAt(row, snapshotAt) && row.zonaActual === zona,
    );
    const entered = cohort.filter((row) => rankReached(row) >= index).length;
    const advanced = cohort.filter(
      (row) => rankReached(row) >= index + 1,
    ).length;
    const nextLabel =
      index < OUV_DASHBOARD_ZONES.length - 1
        ? OUV_DASHBOARD_ZONE_LABEL[OUV_DASHBOARD_ZONES[index + 1]]
        : 'Cierre';
    return {
      zona,
      label: OUV_DASHBOARD_ZONE_LABEL[zona],
      amount: roundMoney(
        openInZone.reduce((sum, row) => sum + row.presupuestoMonto, 0),
      ),
      count: openInZone.length,
      conversion_to_next: entered > 0 ? roundRatio(advanced / entered) : null,
      next_label: nextLabel,
    };
  });

  const comparable = funnel.filter((step) => step.conversion_to_next != null);
  const bottleneck = comparable.reduce<OuvDashboardMetrics['bottleneck']>(
    (lowest, step) => {
      const rate = step.conversion_to_next!;
      if (!lowest || rate < lowest.rate) {
        return { from_label: step.label, to_label: step.next_label, rate };
      }
      return lowest;
    },
    null,
  );

  const reasonRows = [...reasons.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const visibleReasons = reasonRows.slice(0, 5);
  const hidden = reasonRows.slice(5);
  if (hidden.length > 0) {
    visibleReasons.push({
      label: 'Otros',
      count: hidden.reduce((sum, row) => sum + row.count, 0),
    });
  }

  const sectorMap = new Map<
    string,
    {
      amount: number;
      open_count: number;
      open_amount_now: number;
      won: number;
      lost: number;
      won_amount: number;
      lost_amount: number;
    }
  >();
  for (const row of rows) {
    const bucket = sectorMap.get(row.segmento) ?? {
      amount: 0,
      open_count: 0,
      open_amount_now: 0,
      won: 0,
      lost: 0,
      won_amount: 0,
      lost_amount: 0,
    };
    if (isOpenAt(row, snapshotAt)) bucket.amount += row.presupuestoMonto;
    if (isDashboardOpen(row)) {
      bucket.open_count += 1;
      bucket.open_amount_now += row.presupuestoMonto;
    }
    if (isWonInPeriod(row, period)) {
      bucket.won += 1;
      bucket.won_amount += row.montoFinal;
    }
    if (isLostInPeriod(row, period)) {
      bucket.lost += 1;
      bucket.lost_amount += lostAmount(row);
    }
    sectorMap.set(row.segmento, bucket);
  }

  const openTotal = openNow.amount;
  const pipelineBySector = [...sectorMap.entries()]
    .map(([segmento, bucket]) => {
      const decided = bucket.won + bucket.lost;
      return {
        segmento,
        amount: roundMoney(bucket.amount),
        open_count: bucket.open_count,
        open_amount_now: roundMoney(bucket.open_amount_now),
        share: openTotal > 0 ? roundRatio(bucket.amount / openTotal) : 0,
        win_rate: decided > 0 ? roundRatio(bucket.won / decided) : null,
        win_rate_amount: amountWinRate(bucket.won_amount, bucket.lost_amount),
      };
    })
    .filter((row) => row.amount > 0 || row.win_rate != null)
    .sort(
      (a, b) => b.amount - a.amount || a.segmento.localeCompare(b.segmento),
    );

  const executiveMap = new Map<
    string,
    {
      full_name: string;
      open_count: number;
      pipeline_amount: number;
      open_count_now: number;
      open_amount_now: number;
      won: number;
      lost: number;
      won_amount: number;
      lost_amount: number;
    }
  >();
  for (const row of rows) {
    const bucket = executiveMap.get(row.comercialId) ?? {
      full_name: row.comercialName || 'Sin ejecutivo',
      open_count: 0,
      pipeline_amount: 0,
      open_count_now: 0,
      open_amount_now: 0,
      won: 0,
      lost: 0,
      won_amount: 0,
      lost_amount: 0,
    };
    if (isOpenAt(row, snapshotAt)) {
      bucket.open_count += 1;
      bucket.pipeline_amount += row.presupuestoMonto;
    }
    if (isDashboardOpen(row)) {
      bucket.open_count_now += 1;
      bucket.open_amount_now += row.presupuestoMonto;
    }
    if (isWonInPeriod(row, period)) {
      bucket.won += 1;
      bucket.won_amount += row.montoFinal;
    }
    if (isLostInPeriod(row, period)) {
      bucket.lost += 1;
      bucket.lost_amount += lostAmount(row);
    }
    executiveMap.set(row.comercialId, bucket);
  }

  const executives = [...executiveMap.entries()]
    .map(([userId, bucket]) => {
      const decided = bucket.won + bucket.lost;
      return {
        user_id: userId,
        full_name: bucket.full_name,
        open_count: bucket.open_count,
        pipeline_amount: roundMoney(bucket.pipeline_amount),
        open_count_now: bucket.open_count_now,
        open_amount_now: roundMoney(bucket.open_amount_now),
        win_rate: decided > 0 ? roundRatio(bucket.won / decided) : null,
        win_rate_amount: amountWinRate(bucket.won_amount, bucket.lost_amount),
        won_amount: roundMoney(bucket.won_amount),
      };
    })
    .filter(
      (row) =>
        row.open_count > 0 ||
        row.open_count_now > 0 ||
        row.win_rate != null ||
        row.won_amount > 0,
    )
    .sort(
      (a, b) =>
        b.pipeline_amount - a.pipeline_amount ||
        a.full_name.localeCompare(b.full_name),
    );

  const staleReference = snapshotAt;
  const staleCutoff =
    staleReference.getTime() - OUV_DASHBOARD_STALE_DAYS * DAY_MS;
  const stalled = rows
    .filter(
      (row) =>
        isOpenAt(row, staleReference) && row.updatedAt.getTime() < staleCutoff,
    )
    .map((row) => ({
      ouv_id: row.ouvId,
      consecutivo: row.consecutivo,
      titulo: row.titulo,
      zona: zoneOf(row.zonaActual)
        ? OUV_DASHBOARD_ZONE_LABEL[zoneOf(row.zonaActual)!]
        : row.zonaActual,
      amount: roundMoney(row.presupuestoMonto),
      days_stale: Math.floor(
        (staleReference.getTime() - row.updatedAt.getTime()) / DAY_MS,
      ),
      comercial_name: row.comercialName || 'Sin ejecutivo',
    }))
    .sort(
      (a, b) =>
        b.days_stale - a.days_stale ||
        a.consecutivo.localeCompare(b.consecutivo),
    )
    .slice(0, 8);

  const deltaRatio =
    openPrevious && openPrevious.amount > 0
      ? roundRatio((openNow.amount - openPrevious.amount) / openPrevious.amount)
      : null;
  const deltaPoints =
    currentClose.rate != null && previousClose?.rate != null
      ? Math.round((currentClose.rate - previousClose.rate) * 1000) / 10
      : null;

  return {
    period: {
      active: period != null,
      period_from: period ? bogotaYmd(period.start) : null,
      period_to: period ? inclusiveEndYmd(period.end) : null,
      year: resolved.year,
      quarter: resolved.quarter,
      compare_from: previous ? bogotaYmd(previous.start) : null,
      compare_to: previous ? inclusiveEndYmd(previous.end) : null,
    },
    pipeline_weighted: {
      amount: roundMoney(openNow.weighted),
      open_amount: roundMoney(openNow.amount),
      weight_share:
        openNow.amount > 0
          ? roundRatio(openNow.weighted / openNow.amount)
          : null,
      weights: OUV_DASHBOARD_ZONES.map((zona) => ({
        zona,
        label: OUV_DASHBOARD_ZONE_LABEL[zona],
        weight: OUV_DASHBOARD_ZONE_WEIGHT[zona],
      })),
    },
    pipeline_value: {
      amount: roundMoney(openNow.amount),
      count: openNow.count,
      delta_ratio: deltaRatio,
    },
    close_rate: {
      rate: currentClose.rate == null ? null : roundRatio(currentClose.rate),
      rate_amount: amountWinRate(wonAmount, lostAmountSum),
      delta_points: deltaPoints,
      won_count: currentClose.won,
      lost_count: currentClose.lost,
    },
    sales_cycle: {
      avg_days:
        average(cycleDays) == null ? null : Math.round(average(cycleDays)!),
      by_segment: [...cycleBySegment.entries()]
        .map(([segmento, days]) => ({
          segmento,
          avg_days: Math.round(average(days)!),
          count: days.length,
        }))
        .sort(
          (a, b) => b.count - a.count || a.segmento.localeCompare(b.segmento),
        ),
    },
    new_ouvs: { count: newCount, amount: roundMoney(newAmount) },
    funnel,
    bottleneck,
    won_vs_lost: {
      won: { count: currentClose.won, amount: roundMoney(wonAmount) },
      lost: { count: currentClose.lost, amount: roundMoney(lostAmountSum) },
      loss_reasons: visibleReasons.map((reason) => ({
        label: reason.label,
        count: reason.count,
        share:
          currentClose.lost > 0
            ? roundRatio(reason.count / currentClose.lost)
            : 0,
      })),
    },
    pipeline_by_sector: pipelineBySector,
    new_origins: [...origins.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 8),
    executives,
    by_segment: buildSegmentBreakdown(rows, period),
    mayor_probabilidad_by_segment: buildMayorProbabilidad(rows),
    stalled,
  };
}

type SegmentBucket = {
  open_count: number;
  open_amount: number;
  won_count: number;
  won_amount: number;
  lost_count: number;
  lost_amount: number;
};

function emptySegmentBucket(): SegmentBucket {
  return {
    open_count: 0,
    open_amount: 0,
    won_count: 0,
    won_amount: 0,
    lost_count: 0,
    lost_amount: 0,
  };
}

function buildSegmentBreakdown(
  rows: OuvDashboardSourceRow[],
  period: HalfOpenRange | null,
): OuvDashboardMetrics['by_segment'] {
  const map = new Map<string, SegmentBucket>();
  for (const row of rows) {
    const bucket = map.get(row.segmento) ?? emptySegmentBucket();
    if (isDashboardOpen(row)) {
      bucket.open_count += 1;
      bucket.open_amount += row.presupuestoMonto;
    }
    if (isWonInPeriod(row, period)) {
      bucket.won_count += 1;
      bucket.won_amount += row.montoFinal;
    }
    if (isLostInPeriod(row, period)) {
      bucket.lost_count += 1;
      bucket.lost_amount += lostAmount(row);
    }
    map.set(row.segmento, bucket);
  }

  return [...map.entries()]
    .filter(([, bucket]) => segmentBucketHasRows(bucket))
    .map(([segmento, bucket]) => ({
      segmento,
      open_count: bucket.open_count,
      open_amount: roundMoney(bucket.open_amount),
      won_count: bucket.won_count,
      won_amount: roundMoney(bucket.won_amount),
      lost_count: bucket.lost_count,
      lost_amount: roundMoney(bucket.lost_amount),
      win_rate:
        bucket.won_count + bucket.lost_count > 0
          ? roundRatio(
              bucket.won_count / (bucket.won_count + bucket.lost_count),
            )
          : null,
      win_rate_amount: amountWinRate(bucket.won_amount, bucket.lost_amount),
    }))
    .sort((a, b) => a.segmento.localeCompare(b.segmento, 'es'));
}

function segmentBucketHasRows(bucket: SegmentBucket): boolean {
  return bucket.open_count > 0 || bucket.won_count > 0 || bucket.lost_count > 0;
}

function buildMayorProbabilidad(
  rows: OuvDashboardSourceRow[],
): OuvDashboardMetrics['mayor_probabilidad_by_segment'] {
  const map = new Map<string, { count: number; amount: number }>();
  for (const row of rows) {
    if (!isMayorProbabilidadAbierta(row)) continue;
    const bucket = map.get(row.segmento) ?? { count: 0, amount: 0 };
    bucket.count += 1;
    bucket.amount += row.presupuestoMonto;
    map.set(row.segmento, bucket);
  }
  return [...map.entries()]
    .map(([segmento, bucket]) => ({
      segmento,
      count: bucket.count,
      amount: roundMoney(bucket.amount),
    }))
    .sort(
      (a, b) =>
        b.amount - a.amount || a.segmento.localeCompare(b.segmento, 'es'),
    );
}

export const OUV_DASHBOARD_DETAIL_KINDS = [
  'open_by_segment',
  'won_by_segment',
  'lost_by_segment',
  'mayor_probabilidad',
  'won_by_executive',
  'open_by_executive',
] as const;

export type OuvDashboardDetailKind =
  (typeof OUV_DASHBOARD_DETAIL_KINDS)[number];

export type OuvDashboardDetailFechaTipo = 'creacion' | 'cierre';

export type OuvDashboardDetailItem = {
  ouv_id: string;
  consecutivo: string;
  titulo: string;
  empresa: string;
  comercial: string;
  segmento: string;
  zona: string;
  monto: number;
  moneda: string | null;
  fecha: string | null;
  fecha_tipo: OuvDashboardDetailFechaTipo;
};

function detailMatches(
  row: OuvDashboardSourceRow,
  kind: OuvDashboardDetailKind,
  period: HalfOpenRange | null,
): boolean {
  switch (kind) {
    case 'open_by_segment':
    case 'open_by_executive':
      return isDashboardOpen(row);
    case 'won_by_segment':
    case 'won_by_executive':
      return isWonInPeriod(row, period);
    case 'lost_by_segment':
      return isLostInPeriod(row, period);
    case 'mayor_probabilidad':
      return isMayorProbabilidadAbierta(row);
  }
}

function detailAmount(
  row: OuvDashboardSourceRow,
  kind: OuvDashboardDetailKind,
): number {
  if (kind === 'won_by_segment' || kind === 'won_by_executive') {
    return row.montoFinal;
  }
  if (kind === 'lost_by_segment') {
    return lostAmount(row);
  }
  return row.presupuestoMonto;
}

function detailMoneda(
  row: OuvDashboardSourceRow,
  kind: OuvDashboardDetailKind,
): string | null {
  if (kind === 'won_by_segment' || kind === 'won_by_executive') {
    return row.monedaFinal;
  }
  return row.presupuestoMoneda;
}

function detailFecha(
  row: OuvDashboardSourceRow,
  kind: OuvDashboardDetailKind,
): { fecha: string | null; fecha_tipo: OuvDashboardDetailFechaTipo } {
  if (
    kind === 'won_by_segment' ||
    kind === 'won_by_executive' ||
    kind === 'lost_by_segment'
  ) {
    return {
      fecha: row.fechaCierre ? row.fechaCierre.toISOString() : null,
      fecha_tipo: 'cierre',
    };
  }
  return {
    fecha: row.createdAt.toISOString(),
    fecha_tipo: 'creacion',
  };
}

export function listOuvDashboardDetails(
  rows: OuvDashboardSourceRow[],
  input: OuvDashboardPeriodInput,
  kind: OuvDashboardDetailKind,
  zona?: string | null,
): OuvDashboardDetailItem[] {
  const period = resolveOuvDashboardPeriod(input).current;
  return rows
    .filter((row) => detailMatches(row, kind, period))
    .filter((row) => !zona || row.zonaActual === zona)
    .map((row) => {
      const fecha = detailFecha(row, kind);
      return {
        ouv_id: row.ouvId,
        consecutivo: row.consecutivo,
        titulo: row.titulo,
        empresa: row.empresaNombre,
        comercial: row.comercialName,
        segmento: row.segmento,
        zona: row.zonaActual,
        monto: detailAmount(row, kind),
        moneda: detailMoneda(row, kind),
        fecha: fecha.fecha,
        fecha_tipo: fecha.fecha_tipo,
      };
    })
    .sort(
      (a, b) =>
        a.consecutivo.localeCompare(b.consecutivo, 'es') ||
        a.ouv_id.localeCompare(b.ouv_id),
    );
}
