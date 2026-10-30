/** America/Bogota is UTC−5 and has no DST. */
const BOGOTA_BEHIND_UTC_MS = 5 * 60 * 60 * 1000;

function bogotaCalendarParts(instant: Date): {
  year: number;
  month: number;
  day: number;
} {
  const wallClock = new Date(instant.getTime() - BOGOTA_BEHIND_UTC_MS);
  return {
    year: wallClock.getUTCFullYear(),
    month: wallClock.getUTCMonth(),
    day: wallClock.getUTCDate(),
  };
}

function bogotaWallToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
): Date {
  return new Date(
    Date.UTC(year, month, day, hour, minute, second, millisecond) +
      BOGOTA_BEHIND_UTC_MS,
  );
}

/** 00:00:00.000 of the Bogota calendar day that contains `instant`, as UTC. */
export function bogotaDayStart(instant: Date): Date {
  const { year, month, day } = bogotaCalendarParts(instant);
  return bogotaWallToUtc(year, month, day, 0, 0, 0, 0);
}

/**
 * 23:59:59.999 of the Bogota calendar day that contains `instant`, as UTC.
 * Inclusive: an event at that instant is still inside the day.
 */
export function bogotaDayEnd(instant: Date): Date {
  const { year, month, day } = bogotaCalendarParts(instant);
  return bogotaWallToUtc(year, month, day, 23, 59, 59, 999);
}

/** End of the Bogota day `days` calendar days after the day of `instant`. */
export function bogotaDayEndPlus(instant: Date, days: number): Date {
  const { year, month, day } = bogotaCalendarParts(instant);
  return bogotaWallToUtc(year, month, day + days, 23, 59, 59, 999);
}

/** YYYY-MM-DD of the America/Bogota calendar day that contains `instant`. */
export function bogotaYmd(instant: Date): string {
  const { year, month, day } = bogotaCalendarParts(instant);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * 00:00:00.000 America/Bogota of a `YYYY-MM-DD` calendar date, as a UTC instant.
 * A longer ISO string uses its date prefix.
 */
export function bogotaDayStartFromYmd(ymd: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!match) return new Date(Number.NaN);
  return bogotaWallToUtc(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    0,
    0,
    0,
    0,
  );
}

/** Shift a Bogota calendar date by whole days. `2026-10-21` minus 7 is `2026-10-14`. */
export function addBogotaCalendarDays(ymd: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!match) return ymd.slice(0, 10);
  return bogotaYmd(
    bogotaWallToUtc(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]) + days,
      0,
      0,
      0,
      0,
    ),
  );
}

/** Whole America/Bogota calendar days from `earlier` to `later`. */
export function bogotaCalendarDaysBetween(earlier: Date, later: Date): number {
  const from = bogotaCalendarParts(earlier);
  const to = bogotaCalendarParts(later);
  const fromIndex = Math.floor(
    Date.UTC(from.year, from.month, from.day) / 86_400_000,
  );
  const toIndex = Math.floor(Date.UTC(to.year, to.month, to.day) / 86_400_000);
  return toIndex - fromIndex;
}
