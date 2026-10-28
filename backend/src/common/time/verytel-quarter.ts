import { bogotaDayEnd, bogotaDayStart } from './bogota-day';

export type VerytelQuarter = 1 | 2 | 3 | 4;

export type VerytelQuarterPoint = {
  fiscalYear: number;
  quarter: VerytelQuarter;
};

export type VerytelQuarterRange = VerytelQuarterPoint & {
  /** Inclusive start: 00:00:00.000 America/Bogota. */
  start: Date;
  /** Inclusive end: 23:59:59.999 America/Bogota. */
  end: Date;
};

const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

type Ymd = { year: number; month: number; day: number };

/**
 * Calendar date in America/Bogota. `bogotaDayStart` is 00:00 Bogota, which is
 * 05:00 UTC, so the UTC Y-M-D of that instant is the Bogota date.
 */
function bogotaYmd(instant: Date): Ymd {
  const start = bogotaDayStart(instant);
  return {
    year: start.getUTCFullYear(),
    month: start.getUTCMonth(),
    day: start.getUTCDate(),
  };
}

function atBogotaNoon(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 12, 0, 0));
}

function compareYmd(left: Ymd, right: Ymd): number {
  if (left.year !== right.year) return left.year - right.year;
  if (left.month !== right.month) return left.month - right.month;
  return left.day - right.day;
}

export function verytelQuarterOf(instant: Date): VerytelQuarterPoint {
  const { year, month } = bogotaYmd(instant);
  if (month === 0) {
    return { fiscalYear: year - 1, quarter: 4 };
  }
  if (month <= 3) {
    return { fiscalYear: year, quarter: 1 };
  }
  if (month <= 6) {
    return { fiscalYear: year, quarter: 2 };
  }
  if (month <= 9) {
    return { fiscalYear: year, quarter: 3 };
  }
  return { fiscalYear: year, quarter: 4 };
}

/**
 * Half-open window [start, end) at America/Bogota midnights.
 * Without a quarter, the window is the full fiscal year: 1 Feb → 1 Feb next year.
 */
export function verytelFiscalPeriod(
  fiscalYear: number,
  quarter?: VerytelQuarter | null,
): { start: Date; end: Date } {
  const from = quarter ?? 1;
  const to = quarter ?? 4;
  const start = verytelQuarterRange(fiscalYear, from).start;
  const inclusiveEnd = verytelQuarterRange(fiscalYear, to).end;
  return { start, end: new Date(inclusiveEnd.getTime() + 1) };
}

export function verytelQuarterRange(
  fiscalYear: number,
  quarter: VerytelQuarter,
): VerytelQuarterRange {
  const bounds: Record<
    VerytelQuarter,
    { start: [number, number]; end: [number, number]; endYearOffset: number }
  > = {
    1: { start: [1, 1], end: [3, 30], endYearOffset: 0 },
    2: { start: [4, 1], end: [6, 31], endYearOffset: 0 },
    3: { start: [7, 1], end: [9, 31], endYearOffset: 0 },
    4: { start: [10, 1], end: [0, 31], endYearOffset: 1 },
  };
  const bound = bounds[quarter];
  const start = bogotaDayStart(
    atBogotaNoon(fiscalYear, bound.start[0], bound.start[1]),
  );
  const end = bogotaDayEnd(
    atBogotaNoon(fiscalYear + bound.endYearOffset, bound.end[0], bound.end[1]),
  );
  return { fiscalYear, quarter, start, end };
}

export function formatVerytelQuarterTitle(
  fiscalYear: number,
  quarter: VerytelQuarter,
): string {
  return `Q${quarter} ${fiscalYear}`;
}

function formatBogotaDay(instant: Date): string {
  const { year, month, day } = bogotaYmd(instant);
  return `${day} ${MONTHS[month]} ${year}`;
}

export function formatVerytelQuarterRange(range: VerytelQuarterRange): string {
  return `${formatBogotaDay(range.start)} – ${formatBogotaDay(range.end)}`;
}

export function isVerytelQuarterFinished(
  range: VerytelQuarterRange,
  now: Date,
): boolean {
  return compareYmd(bogotaYmd(now), bogotaYmd(range.end)) > 0;
}
