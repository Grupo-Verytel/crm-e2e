import { bogotaDayEnd } from '../../../common/time/bogota-day';

export const REMINDER_GROUPS = ['OVERDUE', 'TODAY', 'UPCOMING'] as const;

export type ReminderGroup = (typeof REMINDER_GROUPS)[number];

/**
 * Bell bucket for one `event_at`. OVERDUE is strictly before `now`.
 * TODAY runs through the end of the Bogota day (inclusive). UPCOMING is after that.
 */
export function resolveReminderGroup(eventAt: Date, now: Date): ReminderGroup {
  if (eventAt.getTime() < now.getTime()) {
    return 'OVERDUE';
  }
  if (eventAt.getTime() <= bogotaDayEnd(now).getTime()) {
    return 'TODAY';
  }
  return 'UPCOMING';
}

/** Same rule as `resolveReminderGroup`. `column` is a SQL expression. */
export function reminderGroupCase(column: string): string {
  return `CASE
    WHEN ${column} < :now THEN 'OVERDUE'
    WHEN ${column} <= :todayEnd THEN 'TODAY'
    ELSE 'UPCOMING'
  END`;
}
