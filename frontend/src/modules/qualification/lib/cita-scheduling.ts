import type { GraphSchedule } from '../api/graph-api';

/** Wall-clock timezone for SQL citas (Colombia, no DST). */
export const CITA_TIMEZONE = 'America/Bogota';

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

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function bogotaParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CITA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '0';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  };
}

export function formatBogota(date: Date): { fecha: string; hora: string } {
  const p = bogotaParts(date);
  return {
    fecha: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    hora: `${pad(p.hour)}:${pad(p.minute)}`,
  };
}

/** Interpret YYYY-MM-DD + HH:mm as America/Bogota (UTC-5). */
export function zonedBogotaDate(fecha: string, hora: string): Date {
  const time = hora.length === 5 ? `${hora}:00` : hora.slice(0, 8);
  return new Date(`${fecha.slice(0, 10)}T${time}-05:00`);
}

export function startOfWeek(date: Date): Date {
  const { fecha } = formatBogota(date);
  const midnight = zonedBogotaDate(fecha, '00:00');
  const day = midnight.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const [year, month, dayNum] = fecha.split('-').map(Number);
  const monday = new Date(Date.UTC(year, month - 1, dayNum + diff));
  const mondayFecha = `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`;
  return zonedBogotaDate(mondayFecha, '00:00');
}

export function weekDayLabels(anchor: Date): string[] {
  const monday = startOfWeek(anchor);
  return DAY_LABELS.map((label, i) => {
    const { fecha } = formatBogota(monday);
    const [year, month, day] = fecha.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day + i));
    return `${d.getUTCDate()} ${label}`;
  });
}

export function toGraphLocalDateTime(date: Date): string {
  const { fecha, hora } = formatBogota(date);
  return `${fecha}T${hora}`;
}

export function weekWindow(anchor: Date): { start: Date; end: Date } {
  const start = startOfWeek(anchor);
  const end = new Date(start.getTime() + 5 * 24 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * Graph `getSchedule` returns UTC instants (`13:00` for 08:00 Bogotá).
 * The availability API converts them to America/Bogota wall-clock before
 * the frontend sees them. Naive values are therefore Bogotá; ISO with Z or
 * an offset is parsed as an absolute instant.
 */
export function parseGraphDateTime(value: string): Date | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  if (/[zZ]$/.test(raw) || /[+-]\d{2}:\d{2}/.test(raw)) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(
    raw,
  );
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  return zonedBogotaDate(`${y}-${mo}-${d}`, `${h}:${mi}`);
}

export function bogotaSlotFromGrid(
  weekAnchor: Date,
  dayIndex: number,
  hour: number,
  durationMinutes: number,
): { start: Date; end: Date } {
  const { fecha } = formatBogota(startOfWeek(weekAnchor));
  const [year, month, day] = fecha.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1, day + dayIndex));
  const targetFecha = `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(target.getUTCDate())}`;
  const start = zonedBogotaDate(targetFecha, `${pad(hour)}:00`);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { start, end };
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
        label: `Cita ${formatBogota(params.proposedStart).hora}–${formatBogota(params.proposedEnd).hora}`,
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
        `${item.subject?.trim() || 'Ocupado'} ${formatBogota(start).hora}–${formatBogota(end).hora}`,
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
  const start = zonedBogotaDate(fecha, hora);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { start, end };
}

function dayIndexFrom(monday: Date, date: Date): number {
  const a = formatBogota(monday).fecha;
  const b = formatBogota(date).fecha;
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const start = Date.UTC(ay, am - 1, ad);
  const other = Date.UTC(by, bm - 1, bd);
  return Math.round((other - start) / 86_400_000);
}

function sameDay(a: Date, b: Date): boolean {
  return formatBogota(a).fecha === formatBogota(b).fecha;
}

function toHourFloat(d: Date): number {
  const p = bogotaParts(d);
  return p.hour + p.minute / 60;
}
