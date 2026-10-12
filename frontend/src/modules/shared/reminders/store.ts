import {
  OUV_REMINDERS_CHANGED_EVENT,
  type OuvReminder,
  type OuvReminderResolution,
} from './types';

const STORAGE_KEY = 'crm-ouv-recordatorios-v1';

function readAll(): OuvReminder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OuvReminder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: OuvReminder[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(OUV_REMINDERS_CHANGED_EVENT));
}

export function getReminderResolution(
  reminder: OuvReminder,
): OuvReminderResolution | null {
  if (reminder.resolution === 'done' || reminder.resolution === 'dismissed') {
    return reminder.resolution;
  }
  if (reminder.dismissed_at) return 'dismissed';
  return null;
}

export function listOuvReminders(): OuvReminder[] {
  return readAll().sort(
    (a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime(),
  );
}

export function listRemindersForOuv(ouvId: string): OuvReminder[] {
  return listOuvReminders()
    .filter((row) => row.ouv_id === ouvId)
    .sort((a, b) => {
      const aRes = getReminderResolution(a);
      const bRes = getReminderResolution(b);
      if (!aRes && bRes) return -1;
      if (aRes && !bRes) return 1;
      const aAt = a.resolved_at ?? a.dismissed_at ?? a.remind_at;
      const bAt = b.resolved_at ?? b.dismissed_at ?? b.remind_at;
      return new Date(bAt).getTime() - new Date(aAt).getTime();
    });
}

export function listResolvedRemindersForOuv(ouvId: string): OuvReminder[] {
  return listRemindersForOuv(ouvId).filter(
    (row) => getReminderResolution(row) != null,
  );
}

export function upsertOuvReminder(
  input: Omit<OuvReminder, 'created_at' | 'dismissed_at' | 'resolution' | 'resolved_at'> & {
    created_at?: string;
  },
): OuvReminder {
  const items = readAll().filter(
    (row) => row.interaccion_id !== input.interaccion_id,
  );
  const next: OuvReminder = {
    ...input,
    created_at: input.created_at ?? new Date().toISOString(),
    dismissed_at: null,
    resolution: null,
    resolved_at: null,
  };
  writeAll([next, ...items]);
  return next;
}

export function resolveOuvReminder(
  reminderId: string,
  resolution: OuvReminderResolution,
): void {
  const now = new Date().toISOString();
  writeAll(
    readAll().map((row) =>
      row.reminder_id === reminderId
        ? {
            ...row,
            resolution,
            resolved_at: now,
            dismissed_at: resolution === 'dismissed' ? now : null,
          }
        : row,
    ),
  );
}

export function dismissOuvReminder(reminderId: string): void {
  resolveOuvReminder(reminderId, 'dismissed');
}

export function removeOuvReminderByInteraccion(interaccionId: string): void {
  writeAll(readAll().filter((row) => row.interaccion_id !== interaccionId));
}

export function isReminderDue(reminder: OuvReminder, now = Date.now()): boolean {
  if (getReminderResolution(reminder)) return false;
  return new Date(reminder.remind_at).getTime() <= now;
}

export type ReminderDisplayStatus =
  | 'realizado'
  | 'vencido'
  | 'descartado'
  | 'programado';

export function getReminderDisplayStatus(
  reminder: OuvReminder,
  now = Date.now(),
): ReminderDisplayStatus {
  return getReminderDisplayStatuses(reminder, now)[0] ?? 'programado';
}

export function getReminderDisplayStatuses(
  reminder: OuvReminder,
  now = Date.now(),
): ReminderDisplayStatus[] {
  const resolution = getReminderResolution(reminder);
  const dueAt = new Date(reminder.remind_at).getTime();
  if (resolution === 'done') {
    const markedAt = new Date(
      reminder.resolved_at ?? reminder.dismissed_at ?? 0,
    ).getTime();
    return Number.isFinite(markedAt) && markedAt > dueAt
      ? ['realizado', 'vencido']
      : ['realizado'];
  }
  if (dueAt <= now) return ['vencido'];
  if (resolution === 'dismissed') return ['descartado'];
  return ['programado'];
}

export function combineReminderIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const match = time.trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  const hhMm = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const d = new Date(`${date}T${hhMm}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
