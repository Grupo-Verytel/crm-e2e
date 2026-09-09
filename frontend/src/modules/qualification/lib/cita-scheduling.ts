import type { GraphSchedule } from '../api/graph-api';

export type CitaResource = {
  id: string;
  email: string;
  label: string;
};

export type BusyBlock = {
  id: string;
  resourceId: string;
  label: string;
  dayIndex: number;
  startHour: number;
  endHour: number;
  tone: 'busy' | 'provisional' | 'proposed';
};

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'] as const;

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function weekDayLabels(anchor: Date): string[] {
  const monday = startOfWeek(anchor);
  return DAY_LABELS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return `${d.getDate()} ${label}`;
  });
}

export function toGraphLocalDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function weekWindow(anchor: Date): { start: Date; end: Date } {
  const start = startOfWeek(anchor);
  const end = new Date(start);
  end.setDate(start.getDate() + 5);
  return { start, end };
}

export function parseGraphDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(
    value ?? '',
  );
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  return new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s ?? '0'),
  );
}

const BUSY_STATUS = new Set(['busy', 'oof', 'workingElsewhere']);

export function buildAvailabilityBlocks(params: {
  weekAnchor: Date;
  resource: CitaResource;
  schedules: GraphSchedule[];
  proposedStart: Date | null;
  proposedEnd: Date | null;
}): BusyBlock[] {
  const monday = startOfWeek(params.weekAnchor);
  const byEmail = new Map(
    params.schedules.map((schedule) => [
      schedule.email.toLowerCase(),
      schedule,
    ]),
  );
  const blocks: BusyBlock[] = [];
  const schedule = byEmail.get(params.resource.email.toLowerCase());

  if (schedule) {
    schedule.items.forEach((item, index) => {
      const start = parseGraphDateTime(item.start);
      const end = parseGraphDateTime(item.end);
      if (!start || !end) return;
      const dayIndex = dayIndexFrom(monday, start);
      if (dayIndex < 0 || dayIndex > 4) return;
      const status = item.status ?? 'busy';
      if (status === 'free') return;
      blocks.push({
        id: `${params.resource.id}-${index}-${item.start}`,
        resourceId: params.resource.id,
        label: item.subject?.trim() || params.resource.label,
        dayIndex,
        startHour: toHourFloat(start),
        endHour: sameDay(start, end) ? toHourFloat(end) : 24,
        tone: BUSY_STATUS.has(status) ? 'busy' : 'provisional',
      });
    });
  }

  if (params.proposedStart && params.proposedEnd) {
    const dayIndex = dayIndexFrom(monday, params.proposedStart);
    if (dayIndex >= 0 && dayIndex <= 4) {
      const startHour = toHourFloat(params.proposedStart);
      const endHour = toHourFloat(params.proposedEnd);
      blocks.push({
        id: 'proposed',
        resourceId: 'proposed',
        label: `Cita ${padTime(params.proposedStart)}–${padTime(params.proposedEnd)}`,
        dayIndex,
        startHour,
        endHour: Math.max(endHour, startHour + 0.25),
        tone: 'proposed',
      });
    }
  }

  return blocks;
}

export function slotConflicts(params: {
  start: Date;
  end: Date;
  email: string;
  schedules: GraphSchedule[];
}): string[] {
  const schedule = params.schedules.find(
    (row) => row.email.toLowerCase() === params.email.toLowerCase(),
  );
  if (!schedule || schedule.error) {
    return [];
  }
  const conflicts: string[] = [];
  for (const item of schedule.items) {
    if (item.status === 'free') continue;
    const start = parseGraphDateTime(item.start);
    const end = parseGraphDateTime(item.end);
    if (!start || !end) continue;
    if (params.start.getTime() < end.getTime() && start.getTime() < params.end.getTime()) {
      conflicts.push(
        `${item.subject?.trim() || 'Ocupado'} ${padTime(start)}–${padTime(end)}`,
      );
    }
  }
  return conflicts;
}

export function combineFechaHora(
  fecha: string,
  hora: string,
  durationMinutes: number,
): { start: Date; end: Date } | null {
  if (!fecha || !hora) return null;
  const [year, month, day] = fecha.split('-').map(Number);
  const [hours, minutes] = hora.split(':').map(Number);
  if (!year || !month || !day || Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  const start = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { start, end };
}

function dayIndexFrom(monday: Date, date: Date): number {
  const day = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
  return Math.round((day - monday.getTime()) / 86_400_000);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toHourFloat(d: Date): number {
  return d.getHours() + d.getMinutes() / 60;
}

function padTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
