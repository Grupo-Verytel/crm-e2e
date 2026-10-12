import type { Ouv } from '../../discovery/api/ouvs-api';
import {
  getReminderResolution,
  listOuvReminders,
} from '../../shared/reminders/store';
import type { OuvReminder } from '../../shared/reminders/types';
import { reminderEntityKind } from '../../shared/reminders/types';
import {
  resolveSqlSeguimientoTone,
  type SqlSeguimientoSort,
  type SqlSeguimientoTone,
} from './sql-seguimiento';

const DAY_MS = 86_400_000;

const TONE_RANK: Record<Exclude<SqlSeguimientoTone, 'vacio'>, number> = {
  verde: 0,
  naranja: 1,
  rojo: 2,
};

/** Oldest pending OUV reminder. Does not include Lead/SQL reminders. */
export function openOuvReminder(ouvId: string): OuvReminder | null {
  const open = listOuvReminders().filter((row) => {
    if (getReminderResolution(row) != null) return false;
    if (reminderEntityKind(row) === 'Lead') return false;
    return row.ouv_id === ouvId;
  });
  if (open.length === 0) return null;
  return open.slice().sort((a, b) => {
    return new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime();
  })[0];
}

export function daysWithoutOuvSeguimiento(
  ouvId: string,
  now = Date.now(),
): number {
  const reminder = openOuvReminder(ouvId);
  if (!reminder) return 0;
  const due = new Date(reminder.remind_at).getTime();
  if (!Number.isFinite(due)) return 0;
  return Math.max(0, Math.floor((now - due) / DAY_MS));
}

export function ouvSeguimientoTone(ouvId: string): SqlSeguimientoTone {
  if (!openOuvReminder(ouvId)) return 'vacio';
  return resolveSqlSeguimientoTone(daysWithoutOuvSeguimiento(ouvId));
}

export function sortOuvsBySeguimiento(
  items: Ouv[],
  sort: SqlSeguimientoSort,
): Ouv[] {
  const direction = sort === 'verdes' ? 1 : -1;
  return [...items].sort((a, b) => {
    const toneA = ouvSeguimientoTone(a.ouv_id);
    const toneB = ouvSeguimientoTone(b.ouv_id);
    if (toneA === 'vacio' && toneB !== 'vacio') return 1;
    if (toneA !== 'vacio' && toneB === 'vacio') return -1;
    if (toneA === 'vacio' || toneB === 'vacio') return 0;
    const toneDiff = (TONE_RANK[toneA] - TONE_RANK[toneB]) * direction;
    if (toneDiff !== 0) return toneDiff;
    const dayDiff =
      daysWithoutOuvSeguimiento(a.ouv_id) - daysWithoutOuvSeguimiento(b.ouv_id);
    return sort === 'rojos' ? -dayDiff : dayDiff;
  });
}
