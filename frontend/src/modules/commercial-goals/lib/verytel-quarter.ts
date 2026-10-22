/**
 * Verytel fiscal quarters. Same rule as `backend/src/common/time/verytel-quarter.ts`.
 * The edge cases live in that backend spec (the frontend has no test runner).
 * Q1 feb–abr, Q2 may–jul, Q3 ago–oct, Q4 nov–ene of the next calendar year.
 * The fiscal year is the year the quarter starts. January belongs to Q4 of the previous year.
 */

export type VerytelQuarter = 1 | 2 | 3 | 4;

export type VerytelQuarterRange = {
  fiscalYear: number;
  quarter: VerytelQuarter;
  start: Date;
  end: Date;
};

const BOGOTA_BEHIND_UTC_MS = 5 * 60 * 60 * 1000;

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

function bogotaYmd(instant: Date): Ymd {
  const wall = new Date(instant.getTime() - BOGOTA_BEHIND_UTC_MS);
  const year = wall.getUTCFullYear();
  const month = wall.getUTCMonth();
  const day = wall.getUTCDate();
  const start = new Date(
    Date.UTC(year, month, day, 0, 0, 0, 0) + BOGOTA_BEHIND_UTC_MS,
  );
  return {
    year: start.getUTCFullYear(),
    month: start.getUTCMonth(),
    day: start.getUTCDate(),
  };
}

function bogotaDayStart(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0) + BOGOTA_BEHIND_UTC_MS);
}

function bogotaDayEnd(year: number, month: number, day: number): Date {
  return new Date(
    Date.UTC(year, month, day, 23, 59, 59, 999) + BOGOTA_BEHIND_UTC_MS,
  );
}

function compareYmd(left: Ymd, right: Ymd): number {
  if (left.year !== right.year) return left.year - right.year;
  if (left.month !== right.month) return left.month - right.month;
  return left.day - right.day;
}

export function verytelQuarterOf(instant: Date): {
  fiscalYear: number;
  quarter: VerytelQuarter;
} {
  const { year, month } = bogotaYmd(instant);
  if (month === 0) return { fiscalYear: year - 1, quarter: 4 };
  if (month <= 3) return { fiscalYear: year, quarter: 1 };
  if (month <= 6) return { fiscalYear: year, quarter: 2 };
  if (month <= 9) return { fiscalYear: year, quarter: 3 };
  return { fiscalYear: year, quarter: 4 };
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
  return {
    fiscalYear,
    quarter,
    start: bogotaDayStart(fiscalYear, bound.start[0], bound.start[1]),
    end: bogotaDayEnd(
      fiscalYear + bound.endYearOffset,
      bound.end[0],
      bound.end[1],
    ),
  };
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

export function formatBogotaTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}
