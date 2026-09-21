/**
 * Marketing fiscal calendar for a selected year (America/Bogota dates).
 *
 * Q1: 1 Feb – 30 Apr
 * Q2: 1 May – 31 Jul
 * Q3: 1 Aug – 31 Oct
 * Q4: 1 Nov – 31 Jan of the following year
 *
 * A year without quarter is the full fiscal year: 1 Feb → 31 Jan next year.
 * Returned `end` is exclusive (next day at Bogotá midnight).
 */

function bogotaDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 5, 0, 0, 0));
}

export function marketingFiscalRange(
  year: number,
  quarter?: number | null,
): { start: Date; end: Date } {
  if (quarter === 1) {
    return { start: bogotaDay(year, 2, 1), end: bogotaDay(year, 5, 1) };
  }
  if (quarter === 2) {
    return { start: bogotaDay(year, 5, 1), end: bogotaDay(year, 8, 1) };
  }
  if (quarter === 3) {
    return { start: bogotaDay(year, 8, 1), end: bogotaDay(year, 11, 1) };
  }
  if (quarter === 4) {
    return { start: bogotaDay(year, 11, 1), end: bogotaDay(year + 1, 2, 1) };
  }
  return { start: bogotaDay(year, 2, 1), end: bogotaDay(year + 1, 2, 1) };
}
