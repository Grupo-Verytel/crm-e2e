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
