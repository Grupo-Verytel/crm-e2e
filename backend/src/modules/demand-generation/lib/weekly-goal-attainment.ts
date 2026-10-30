import {
  verytelFiscalPeriod,
  verytelQuarterOf,
} from '../../../common/time/verytel-quarter';
import type { VerytelQuarter } from '../../../common/time/verytel-quarter';
import { bogotaDayStart } from '../../../common/time/bogota-day';

export const MARKETING_GOAL_METRICS = [
  'INTERACTIONS',
  'LEADS',
  'CONVERTED_OUV',
] as const;

export type MarketingGoalMetric = (typeof MARKETING_GOAL_METRICS)[number];

export type WeeklyGoalRow = {
  fiscalYear: number;
  quarter: number;
  metric: string;
  weeklyTarget: number;
};

export type WeeklyGoalAttainment = {
  actual: number;
  target: number | null;
  attainment_pct: number | null;
};

const DAY_MS = 86_400_000;

/** Bogota midnights that fall inside the half-open range `[start, end)`. */
export function bogotaDaysInRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let cursor = bogotaDayStart(start);
  if (cursor.getTime() < start.getTime()) {
    cursor = new Date(cursor.getTime() + DAY_MS);
  }
  while (cursor.getTime() < end.getTime()) {
    days.push(cursor);
    cursor = new Date(cursor.getTime() + DAY_MS);
  }
  return days;
}

export function fiscalQuarterDayCount(
  fiscalYear: number,
  quarter: VerytelQuarter,
): number {
  const range = verytelFiscalPeriod(fiscalYear, quarter);
  return Math.round((range.end.getTime() - range.start.getTime()) / DAY_MS);
}

/**
 * Weekly goal measured on whatever range the dashboard already selected.
 * A missing row and a stored 0 both add nothing. One rounding, on the total.
 */
export function weeklyGoalAttainment(input: {
  range: { start: Date; end: Date } | null;
  metric: MarketingGoalMetric;
  rows: WeeklyGoalRow[];
  actual: number;
}): WeeklyGoalAttainment {
  if (!input.range) {
    return { actual: input.actual, target: null, attainment_pct: null };
  }

  const daysByQuarter = new Map<
    string,
    { fiscalYear: number; quarter: number; days: number }
  >();
  for (const day of bogotaDaysInRange(input.range.start, input.range.end)) {
    const point = verytelQuarterOf(day);
    const key = `${point.fiscalYear}:${point.quarter}`;
    const current = daysByQuarter.get(key);
    if (current) {
      current.days += 1;
    } else {
      daysByQuarter.set(key, {
        fiscalYear: point.fiscalYear,
        quarter: point.quarter,
        days: 1,
      });
    }
  }

  let sum = 0;
  for (const slice of daysByQuarter.values()) {
    const row = input.rows.find(
      (candidate) =>
        candidate.metric === input.metric &&
        candidate.fiscalYear === slice.fiscalYear &&
        candidate.quarter === slice.quarter,
    );
    const weeklyTarget = row?.weeklyTarget ?? 0;
    sum += (weeklyTarget * slice.days) / 7;
  }

  const target = Math.round(sum);
  if (target === 0) {
    return { actual: input.actual, target: 0, attainment_pct: null };
  }

  return {
    actual: input.actual,
    target,
    attainment_pct: Math.round((input.actual / target) * 100),
  };
}
