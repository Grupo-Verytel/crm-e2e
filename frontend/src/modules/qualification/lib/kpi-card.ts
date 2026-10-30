import {
  verytelQuarterRange,
  type VerytelQuarter,
} from '../../commercial-goals/lib/verytel-quarter';

export type KpiKind = 'count' | 'snapshot' | 'rate';

export type KpiDirection = 'higher_is_better' | 'lower_is_better';

/** `upcoming` is a range that has not started. It uses the same tones as `open`. */
export type PeriodPhase = 'none' | 'open' | 'closed' | 'upcoming';

export type KpiTone = 'accent' | 'danger' | 'warning' | 'met' | 'none';

export function kpiPercent(value: number, denominator: number): number | null {
  if (!(denominator > 0) || !Number.isFinite(value)) return null;
  return Math.round((value / denominator) * 100);
}

/** API ratio in 0–1. Null stays null. */
export function ratePercent(rate: number | null): number | null {
  if (rate == null || !Number.isFinite(rate)) return null;
  return Math.round(rate * 100);
}

export function formatKpiPercent(percent: number | null): string {
  return percent == null ? '—' : `${percent}%`;
}

export function barWidthPercent(percent: number | null): number {
  if (percent == null || !Number.isFinite(percent) || percent <= 0) return 0;
  return Math.min(100, percent);
}

export function bogotaCalendarDay(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function periodPhaseFromBounds(
  active: boolean,
  startDay: string | null,
  endDay: string | null,
  now: Date,
): PeriodPhase {
  if (!active || !startDay || !endDay) return 'none';
  const today = bogotaCalendarDay(now);
  if (today < startDay) return 'upcoming';
  if (today > endDay) return 'closed';
  return 'open';
}

function isQuarter(value: number | null): value is VerytelQuarter {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

export function qualificationFilterBounds(input: {
  year: number | null;
  quarter: number | null;
  periodFrom: string;
  periodTo: string;
}): { startDay: string; endDay: string } | null {
  if (input.periodFrom && input.periodTo) {
    return {
      startDay: input.periodFrom.slice(0, 10),
      endDay: input.periodTo.slice(0, 10),
    };
  }
  if (input.year == null) return null;
  if (isQuarter(input.quarter)) {
    const range = verytelQuarterRange(input.year, input.quarter);
    return {
      startDay: bogotaCalendarDay(range.start),
      endDay: bogotaCalendarDay(range.end),
    };
  }
  return {
    startDay: bogotaCalendarDay(verytelQuarterRange(input.year, 1).start),
    endDay: bogotaCalendarDay(verytelQuarterRange(input.year, 4).end),
  };
}

export function resolveCountTone(
  phase: PeriodPhase,
  percent: number | null,
): KpiTone {
  if (percent == null || phase === 'none') return 'none';
  if (phase === 'open' || phase === 'upcoming') {
    return percent >= 100 ? 'met' : 'accent';
  }
  if (percent < 70) return 'danger';
  if (percent < 100) return 'warning';
  return 'met';
}

export function resolveSnapshotTone(value: number, maximum: number): KpiTone {
  if (!(maximum > 0)) return 'none';
  if (value <= maximum) return 'met';
  if (value <= maximum * 1.25) return 'warning';
  return 'danger';
}

export function resolveKpiTone(input: {
  kind: KpiKind;
  direction: KpiDirection | null;
  phase: PeriodPhase;
  percent: number | null;
  value: number;
  maximum: number;
}): KpiTone {
  if (input.kind === 'rate') {
    return input.percent == null ? 'none' : 'accent';
  }
  if (input.kind === 'snapshot' && input.direction === 'lower_is_better') {
    return resolveSnapshotTone(input.value, input.maximum);
  }
  if (input.kind === 'count' && input.direction === 'higher_is_better') {
    return resolveCountTone(input.phase, input.percent);
  }
  return 'none';
}

export function showsGoalMetLabel(
  phase: PeriodPhase,
  percent: number | null,
): boolean {
  return phase === 'open' && percent != null && percent >= 100;
}
