import { followUpStatusCase, type FollowUpStatus } from './follow-up-status';

export type AssignedOuvsSqlInput = {
  comercialId: string | null;
  search: string | null;
  statuses: FollowUpStatus[] | null;
  now: Date;
  yellowLimit: Date;
  limit: number;
  offset: number;
};

const OPEN_REMINDERS_SUBQUERY = `
SELECT oi.ouv_id, MIN(r.event_at) AS next_reminder_at
FROM reminders r
JOIN ouv_interactions oi ON oi.ouv_interaction_id = r.ouv_interaction_id
WHERE r.completed_at IS NULL
  AND r.status <> 'Cancelado'
  AND r.deleted_at IS NULL
  AND oi.deleted_at IS NULL
GROUP BY oi.ouv_id
`;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function assertPageBounds(limit: number, offset: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('limit must be an integer from 1 to 100');
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error('offset must be an integer >= 0');
  }
}

export function buildAssignedOuvsSql(input: AssignedOuvsSqlInput): {
  listSql: string;
  countSql: string;
  replacements: Record<string, unknown>;
} {
  assertPageBounds(input.limit, input.offset);
  const where = [`o.resultado = 'EnCurso'`];
  const replacements: Record<string, unknown> = {
    now: input.now,
    yellowLimit: input.yellowLimit,
  };
  if (input.comercialId) {
    where.push('o.comercial_id = :comercialId');
    replacements.comercialId = input.comercialId;
  }
  if (input.search) {
    where.push(
      `(o.consecutivo LIKE :search ESCAPE '\\\\' OR o.empresa_nombre LIKE :search ESCAPE '\\\\' OR o.titulo LIKE :search ESCAPE '\\\\')`,
    );
    replacements.search = `%${escapeLike(input.search)}%`;
  }

  const inner = `
    SELECT
      o.ouv_id,
      o.consecutivo,
      o.titulo,
      o.empresa_nombre,
      o.zona_actual,
      o.comercial_id,
      u.full_name AS comercial_nombre,
      n.next_reminder_at,
      ${followUpStatusCase('n.next_reminder_at')} AS follow_up_status
    FROM ouvs o
    LEFT JOIN users u ON u.user_id = o.comercial_id
    LEFT JOIN (${OPEN_REMINDERS_SUBQUERY}) n ON n.ouv_id = o.ouv_id
    WHERE ${where.join(' AND ')}
  `;

  const statusFilter = input.statuses?.length
    ? 'WHERE follow_up_status IN (:statuses)'
    : '';
  if (input.statuses?.length) {
    replacements.statuses = input.statuses;
  }

  const order = `
    ORDER BY CASE follow_up_status
      WHEN 'RED' THEN 1
      WHEN 'YELLOW' THEN 2
      WHEN 'GREEN' THEN 3
      ELSE 4
    END ASC,
    next_reminder_at ASC,
    consecutivo ASC
  `;

  return {
    listSql: `SELECT * FROM (${inner}) assigned ${statusFilter} ${order} LIMIT ${input.limit} OFFSET ${input.offset}`,
    countSql: `SELECT COUNT(*) AS total FROM (${inner}) assigned ${statusFilter}`,
    replacements,
  };
}
