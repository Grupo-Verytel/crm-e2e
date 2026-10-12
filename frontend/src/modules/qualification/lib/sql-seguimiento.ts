import type { SqlDetail } from '../api/sqls-api';
import {
  getReminderResolution,
  listOuvReminders,
} from '../../shared/reminders/store';
import {
  reminderEntityKind,
  type OuvReminder,
} from '../../shared/reminders/types';

export type SqlSeguimientoTone = 'verde' | 'naranja' | 'rojo' | 'vacio';

export type SqlSeguimientoSort = 'verdes' | 'rojos';

const DAY_MS = 86_400_000;

const TONE_RANK: Record<Exclude<SqlSeguimientoTone, 'vacio'>, number> = {
  verde: 0,
  naranja: 1,
  rojo: 2,
};

export const SQL_SEGUIMIENTO_TONE_CLASS: Record<SqlSeguimientoTone, string> = {
  verde: 'bg-semaphore-verde/50',
  naranja: 'bg-semaphore-amarillo',
  rojo: 'bg-danger/45',
  vacio: 'border border-white bg-bg',
};

export const SQL_SEGUIMIENTO_TONE_LABEL: Record<SqlSeguimientoTone, string> = {
  verde: 'Hasta 7 días de retraso',
  naranja: 'Más de 7 días sin completar el seguimiento',
  rojo: 'Más de 14 días sin completar el seguimiento',
  vacio: 'Sin recordatorio programado',
};

function reminderIdsForSql(sql: SqlDetail): Set<string> {
  const ids = [sql.sql_id, sql.lead.lead_id].filter(
    (id): id is string => Boolean(id),
  );
  return new Set(ids);
}

/** Oldest pending Lead/SQL reminder. Does not include OUV reminders. */
export function openSqlReminder(sql: SqlDetail): OuvReminder | null {
  const ids = reminderIdsForSql(sql);
  const open = listOuvReminders().filter((row) => {
    if (getReminderResolution(row) != null) return false;
    if (reminderEntityKind(row) === 'OUV') return false;
    return ids.has(row.ouv_id);
  });
  if (open.length === 0) return null;
  return open.slice().sort((a, b) => {
    return new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime();
  })[0];
}

export function daysWithoutSeguimiento(
  sql: SqlDetail,
  now = Date.now(),
): number {
  const reminder = openSqlReminder(sql);
  if (!reminder) return 0;
  const due = new Date(reminder.remind_at).getTime();
  if (!Number.isFinite(due)) return 0;
  return Math.max(0, Math.floor((now - due) / DAY_MS));
}

export function resolveSqlSeguimientoTone(days: number): SqlSeguimientoTone {
  if (days > 14) return 'rojo';
  if (days > 7) return 'naranja';
  return 'verde';
}

export function sqlSeguimientoTone(sql: SqlDetail): SqlSeguimientoTone {
  if (!openSqlReminder(sql)) return 'vacio';
  return resolveSqlSeguimientoTone(daysWithoutSeguimiento(sql));
}

export function sortSqlsBySeguimiento(
  items: SqlDetail[],
  sort: SqlSeguimientoSort,
): SqlDetail[] {
  const direction = sort === 'verdes' ? 1 : -1;
  return [...items].sort((a, b) => {
    const toneA = sqlSeguimientoTone(a);
    const toneB = sqlSeguimientoTone(b);
    if (toneA === 'vacio' && toneB !== 'vacio') return 1;
    if (toneA !== 'vacio' && toneB === 'vacio') return -1;
    if (toneA === 'vacio' || toneB === 'vacio') return 0;
    const toneDiff = (TONE_RANK[toneA] - TONE_RANK[toneB]) * direction;
    if (toneDiff !== 0) return toneDiff;
    const dayDiff = daysWithoutSeguimiento(a) - daysWithoutSeguimiento(b);
    return sort === 'rojos' ? -dayDiff : dayDiff;
  });
}
