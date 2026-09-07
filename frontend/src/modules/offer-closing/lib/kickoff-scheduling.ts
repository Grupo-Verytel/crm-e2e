import type { GraphSchedule } from '../api/graph-api';
import type {
  KickoffInvitee,
  KickoffSalaVerytel,
  KickoffUbicacionTipo,
} from '../../shared/project/types';

export const KICKOFF_SALAS_VERYTEL: KickoffSalaVerytel[] = [
  'Sala Marte',
  'Sala Júpiter',
];

/** Buzones de recurso de las salas en `grupoverytel.com`. */
export const KICKOFF_SALA_EMAILS: Record<KickoffSalaVerytel, string> = {
  'Sala Marte': 'sala_marte@grupoverytel.com',
  'Sala Júpiter': 'sala_jupiter@grupoverytel.com',
};

/** Un calendario del que se pinta disponibilidad (persona o sala). */
export type KickoffResource = {
  /** Identificador estable en la grilla (id del invitado o nombre de sala). */
  id: string;
  email: string;
  label: string;
  kind: 'persona' | 'sala';
};

export type BusyBlock = {
  id: string;
  resourceId: string;
  label: string;
  dayIndex: number;
  startHour: number;
  endHour: number;
  tone: 'busy' | 'provisional' | 'proposed' | 'room';
};

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'] as const;

export function weekDayLabels(anchor: Date): string[] {
  const monday = startOfWeek(anchor);
  return DAY_LABELS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return `${d.getDate()} ${label}`;
  });
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** `YYYY-MM-DDTHH:mm` en hora local — formato que espera Graph con timeZone. */
export function toGraphLocalDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * Ventana lunes 00:00 → sábado 00:00 de la semana del ancla; es el rango que
 * se pide a `getSchedule` para pintar la grilla completa.
 */
export function weekWindow(anchor: Date): { start: Date; end: Date } {
  const start = startOfWeek(anchor);
  const end = new Date(start);
  end.setDate(start.getDate() + 5);
  return { start, end };
}

/**
 * Graph devuelve `2026-09-04T13:00:00.0000000` — sin offset y ya expresado en
 * el `timeZone` pedido. `new Date(...)` lo interpretaría como UTC en algunos
 * navegadores, así que se parsea componente a componente como hora local.
 */
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

/** Estados de `scheduleItem` que ocupan la agenda. */
const BUSY_STATUS = new Set(['busy', 'oof', 'workingElsewhere']);

export function resourcesFor(params: {
  invitados: KickoffInvitee[];
  salaVerytel: KickoffSalaVerytel | null;
}): KickoffResource[] {
  const resources: KickoffResource[] = [];

  for (const inv of params.invitados) {
    // Solo los buzones del tenant tienen calendario legible por la app.
    if (inv.tipo === 'Externo') continue;
    if (!inv.email.includes('@')) continue;
    resources.push({
      id: inv.id,
      email: inv.email.toLowerCase(),
      label: inv.nombre.split(' ')[0] ?? inv.email,
      kind: 'persona',
    });
  }

  if (params.salaVerytel) {
    resources.push({
      id: params.salaVerytel,
      email: KICKOFF_SALA_EMAILS[params.salaVerytel],
      label: params.salaVerytel,
      kind: 'sala',
    });
  }

  return resources;
}

/** Convierte la respuesta de `getSchedule` en bloques de la grilla semanal. */
export function buildAvailabilityBlocks(params: {
  weekAnchor: Date;
  resources: KickoffResource[];
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

  for (const resource of params.resources) {
    const schedule = byEmail.get(resource.email);
    if (!schedule) continue;

    schedule.items.forEach((item, index) => {
      const start = parseGraphDateTime(item.start);
      const end = parseGraphDateTime(item.end);
      if (!start || !end) return;
      const dayIndex = dayIndexFrom(monday, start);
      if (dayIndex < 0 || dayIndex > 4) return;

      const status = item.status ?? 'busy';
      if (status === 'free') return;

      blocks.push({
        id: `${resource.id}-${index}-${item.start}`,
        resourceId: resource.id,
        label: item.subject?.trim() || resource.label,
        dayIndex,
        // Un bloque que cruza medianoche se recorta al final del día.
        startHour: toHourFloat(start),
        endHour: sameDay(start, end) ? toHourFloat(end) : 24,
        tone:
          resource.kind === 'sala'
            ? 'room'
            : BUSY_STATUS.has(status)
              ? 'busy'
              : 'provisional',
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
        label: `Tu espacio ${padTime(params.proposedStart)}–${padTime(params.proposedEnd)}`,
        dayIndex,
        startHour,
        endHour: Math.max(endHour, startHour + 0.25),
        tone: 'proposed',
      });
    }
  }

  return blocks;
}

export type SlotValidation = {
  ok: boolean;
  conflicts: string[];
  skipped: string[];
};

/** Valida el horario propuesto contra la disponibilidad real de Graph. */
export function validateKickoffSlot(params: {
  inicio: Date;
  fin: Date;
  invitados: KickoffInvitee[];
  ubicaciones: KickoffUbicacionTipo[];
  salaVerytel: KickoffSalaVerytel | null;
  ubicacionDetalle: string;
  resources: KickoffResource[];
  schedules: GraphSchedule[];
}): SlotValidation {
  const conflicts: string[] = [];
  const skipped: string[] = [];

  if (params.ubicaciones.length === 0) {
    return {
      ok: false,
      conflicts: ['Seleccione al menos una ubicación (Teams y/o Presencial).'],
      skipped,
    };
  }

  const byEmail = new Map(
    params.schedules.map((schedule) => [
      schedule.email.toLowerCase(),
      schedule,
    ]),
  );

  for (const inv of params.invitados) {
    if (inv.tipo === 'Externo') {
      skipped.push(`${inv.nombre} — agenda externa (sin validación)`);
      continue;
    }
    const schedule = byEmail.get(inv.email.toLowerCase());
    if (!schedule) {
      skipped.push(`${inv.nombre} — sin datos de calendario`);
      continue;
    }
    if (schedule.error) {
      skipped.push(`${inv.nombre} — ${schedule.error}`);
      continue;
    }
    for (const item of schedule.items) {
      if (item.status === 'free') continue;
      const start = parseGraphDateTime(item.start);
      const end = parseGraphDateTime(item.end);
      if (!start || !end) continue;
      if (overlaps(params.inicio, params.fin, start, end)) {
        conflicts.push(
          `${inv.nombre} ocupado ${padTime(start)}–${padTime(end)}`,
        );
      }
    }
  }

  if (params.ubicaciones.includes('Presencial')) {
    if (params.salaVerytel) {
      const email = KICKOFF_SALA_EMAILS[params.salaVerytel].toLowerCase();
      const schedule = byEmail.get(email);
      if (!schedule || schedule.error) {
        skipped.push(
          `${params.salaVerytel} — ${schedule?.error ?? 'sin datos de calendario'}`,
        );
      } else {
        const ocupada = schedule.items.some((item) => {
          if (item.status === 'free') return false;
          const start = parseGraphDateTime(item.start);
          const end = parseGraphDateTime(item.end);
          return (
            start !== null &&
            end !== null &&
            overlaps(params.inicio, params.fin, start, end)
          );
        });
        if (ocupada) {
          conflicts.push(`${params.salaVerytel} no disponible en ese horario`);
        }
      }
    } else if (params.ubicacionDetalle.trim()) {
      skipped.push(
        'Ubicación presencial fuera de Verytel — sin validación de sala',
      );
    }
  }

  return { ok: conflicts.length === 0, conflicts, skipped };
}

export function formatKickoffRange(inicio: string, fin: string): string {
  const a = new Date(inicio);
  const b = new Date(fin);
  const date = a.toLocaleDateString('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const t1 = a.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const t2 = b.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${date}, ${t1} – ${t2}`;
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

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

function padTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export { DAY_LABELS };
