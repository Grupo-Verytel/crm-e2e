/** America/Bogota is UTC−5, no daylight saving. January belongs to the previous fiscal year. */

const BOGOTA_BEHIND_UTC_MS = 5 * 60 * 60 * 1000;

function bogotaParts(instant: Date): { year: number; month: number } {
  const wall = new Date(instant.getTime() - BOGOTA_BEHIND_UTC_MS);
  return { year: wall.getUTCFullYear(), month: wall.getUTCMonth() };
}

export function bogotaFiscalYear(instant = new Date()): number {
  const { year, month } = bogotaParts(instant);
  return month === 0 ? year - 1 : year;
}

export function bogotaFiscalQuarter(instant = new Date()): 1 | 2 | 3 | 4 {
  const { month } = bogotaParts(instant);
  if (month === 0) return 4;
  if (month <= 3) return 1;
  if (month <= 6) return 2;
  if (month <= 9) return 3;
  return 4;
}
