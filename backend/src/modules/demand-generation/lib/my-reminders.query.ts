import { reminderGroupCase, type ReminderGroup } from './reminder-group';

export type MyRemindersSqlInput = {
  userId: string;
  groups: ReminderGroup[] | null;
  now: Date;
  todayEnd: Date;
  limit: number;
  offset: number;
};

const OPEN_REMINDER_WHERE = `
  r.user_id = :userId
  AND r.completed_at IS NULL
  AND r.status IN ('Pendiente', 'Enviado')
  AND r.deleted_at IS NULL
  AND (
    (
      r.interaction_id IS NOT NULL
      AND r.interaction_id IN (
        SELECT interaction_id FROM interactions WHERE deleted_at IS NULL
      )
    )
    OR (
      r.ouv_interaction_id IS NOT NULL
      AND r.ouv_interaction_id IN (
        SELECT ouv_interaction_id FROM ouv_interactions WHERE deleted_at IS NULL
      )
    )
  )
`;

function assertPageBounds(limit: number, offset: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('limit must be an integer from 1 to 100');
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error('offset must be an integer >= 0');
  }
}

export function buildMyRemindersSql(input: MyRemindersSqlInput): {
  listSql: string;
  countSql: string;
  countsSql: string;
  replacements: Record<string, unknown>;
} {
  assertPageBounds(input.limit, input.offset);
  const replacements: Record<string, unknown> = {
    userId: input.userId,
    now: input.now,
    todayEnd: input.todayEnd,
  };
  const groupCase = reminderGroupCase('r.event_at');
  const groupFilter = input.groups?.length
    ? `AND ${groupCase} IN (:groups)`
    : '';
  if (input.groups?.length) {
    replacements.groups = input.groups;
  }

  const order = `
    ORDER BY CASE
      WHEN r.event_at < :now THEN 1
      WHEN r.event_at <= :todayEnd THEN 2
      ELSE 3
    END ASC,
    r.event_at ASC
  `;

  return {
    listSql: `
      SELECT r.reminder_id, ${groupCase} AS reminder_group
      FROM reminders r
      WHERE ${OPEN_REMINDER_WHERE}
      ${groupFilter}
      ${order}
      LIMIT ${input.limit} OFFSET ${input.offset}
    `,
    countSql: `
      SELECT COUNT(*) AS total
      FROM reminders r
      WHERE ${OPEN_REMINDER_WHERE}
      ${groupFilter}
    `,
    countsSql: `
      SELECT
        COALESCE(SUM(CASE WHEN r.event_at < :now THEN 1 ELSE 0 END), 0) AS overdue,
        COALESCE(SUM(CASE WHEN r.event_at >= :now AND r.event_at <= :todayEnd THEN 1 ELSE 0 END), 0) AS today,
        COALESCE(SUM(CASE WHEN r.event_at > :todayEnd THEN 1 ELSE 0 END), 0) AS upcoming
      FROM reminders r
      WHERE ${OPEN_REMINDER_WHERE}
    `,
    replacements,
  };
}
