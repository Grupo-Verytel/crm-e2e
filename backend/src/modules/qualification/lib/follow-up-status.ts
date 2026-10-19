import { bogotaDayEndPlus } from '../../../common/time/bogota-day';

export const FOLLOW_UP_STATUSES = ['RED', 'YELLOW', 'GREEN', 'NONE'] as const;

export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export const DEFAULT_FOLLOW_UP_YELLOW_DAYS = 2;

/**
 * Missing or blank uses the default. Anything that is not an integer >= 0
 * fails startup instead of painting the semaphore with a guessed window.
 */
export function readFollowUpYellowDays(raw: unknown): number {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return DEFAULT_FOLLOW_UP_YELLOW_DAYS;
  }
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) {
    throw new Error(
      `FOLLOW_UP_YELLOW_DAYS must be an integer >= 0. Received "${text}".`,
    );
  }
  return Number(text);
}

/**
 * Last instant of the Bogota calendar day of `now`, plus `yellowDays`,
 * expressed as a UTC instant. Inclusive: a reminder at 23:59:59.999 Bogota
 * on that day is still yellow.
 */
export function followUpYellowLimit(now: Date, yellowDays: number): Date {
  return bogotaDayEndPlus(now, yellowDays);
}

export function resolveFollowUpStatus(
  nextReminderAt: Date | null,
  now: Date,
  yellowDays: number,
): FollowUpStatus {
  if (!nextReminderAt) {
    return 'NONE';
  }
  if (nextReminderAt.getTime() < now.getTime()) {
    return 'RED';
  }
  if (nextReminderAt.getTime() <= followUpYellowLimit(now, yellowDays).getTime()) {
    return 'YELLOW';
  }
  return 'GREEN';
}

/** Same rule as `resolveFollowUpStatus`. `column` is a SQL expression. */
export function followUpStatusCase(column: string): string {
  return `CASE
    WHEN ${column} IS NULL THEN 'NONE'
    WHEN ${column} < :now THEN 'RED'
    WHEN ${column} <= :yellowLimit THEN 'YELLOW'
    ELSE 'GREEN'
  END`;
}
