import type {
  KickoffInvitee,
  KickoffSalaVerytel,
  KickoffUbicacionTipo,
} from '../../shared/project/types';

export type CompanyUserOption = {
  id: string;
  nombre: string;
  email: string;
  empresa: 'Verytel' | 'Frisson';
};

export const KICKOFF_COMPANY_USERS: CompanyUserOption[] = [
  {
    id: 'vu-001',
    nombre: 'Laura Vargas',
    email: 'laura.vargas@verytel.com',
    empresa: 'Verytel',
  },
  {
    id: 'vu-002',
    nombre: 'Diego Herrera',
    email: 'diego.herrera@verytel.com',
    empresa: 'Verytel',
  },
  {
    id: 'vu-003',
    nombre: 'Ana Ruiz',
    email: 'ana.ruiz@verytel.com',
    empresa: 'Verytel',
  },
  {
    id: 'vu-004',
    nombre: 'Juan David Sánchez',
    email: 'juan.sanchez@verytel.com',
    empresa: 'Verytel',
  },
  {
    id: 'vf-001',
    nombre: 'Carlos Méndez',
    email: 'carlos.mendez@frisson.com',
    empresa: 'Frisson',
  },
  {
    id: 'vf-002',
    nombre: 'María Soto',
    email: 'maria.soto@verytel.com',
    empresa: 'Frisson',
  },
];

export const KICKOFF_SALAS_VERYTEL: KickoffSalaVerytel[] = [
  'Sala Marte',
  'Sala Júpiter',
];

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

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function hashEmail(email: string): number {
  let h = 0;
  for (let i = 0; i < email.length; i += 1) {
    h = (h + email.charCodeAt(i) * (i + 1)) % 997;
  }
  return h;
}

/** Mock busy blocks for internal calendars and Verytel rooms (Mon–Fri, 8–16h). */
export function buildAvailabilityGrid(params: {
  weekAnchor: Date;
  invitados: KickoffInvitee[];
  salaVerytel: KickoffSalaVerytel | null;
  proposedStart: Date | null;
  proposedEnd: Date | null;
}): BusyBlock[] {
  const blocks: BusyBlock[] = [];
  const monday = startOfWeek(params.weekAnchor);

  for (const inv of params.invitados.filter((i) => i.tipo !== 'Externo')) {
    const seed = hashEmail(inv.email);
    for (let day = 0; day < 5; day += 1) {
      const slot = (seed + day * 3) % 5;
      blocks.push({
        id: `${inv.id}-${day}-a`,
        resourceId: inv.id,
        label: inv.nombre.split(' ')[0] ?? inv.email,
        dayIndex: day,
        startHour: 8 + slot,
        endHour: 9 + slot,
        tone: slot % 2 === 0 ? 'busy' : 'provisional',
      });
      if (day === 2) {
        blocks.push({
          id: `${inv.id}-${day}-lunch`,
          resourceId: inv.id,
          label: 'Almuerzo',
          dayIndex: day,
          startHour: 13,
          endHour: 14,
          tone: 'busy',
        });
      }
    }
  }

  if (params.salaVerytel) {
    const roomSeed = params.salaVerytel === 'Sala Marte' ? 2 : 4;
    for (let day = 0; day < 5; day += 1) {
      blocks.push({
        id: `room-${params.salaVerytel}-${day}`,
        resourceId: params.salaVerytel,
        label: params.salaVerytel,
        dayIndex: day,
        startHour: 10 + ((day + roomSeed) % 3),
        endHour: 11 + ((day + roomSeed) % 3),
        tone: 'room',
      });
    }
  }

  if (params.proposedStart && params.proposedEnd) {
    const startDay = new Date(
      params.proposedStart.getFullYear(),
      params.proposedStart.getMonth(),
      params.proposedStart.getDate(),
    );
    const dayIndex = Math.round(
      (startDay.getTime() - monday.getTime()) / 86_400_000,
    );
    if (dayIndex >= 0 && dayIndex < 5) {
      const startHour =
        params.proposedStart.getHours() +
        params.proposedStart.getMinutes() / 60;
      const endHour =
        params.proposedEnd.getHours() + params.proposedEnd.getMinutes() / 60;
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

function padTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export type SlotValidation = {
  ok: boolean;
  conflicts: string[];
  skipped: string[];
};

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function toHourFloat(d: Date): number {
  return d.getHours() + d.getMinutes() / 60;
}

export function validateKickoffSlot(params: {
  inicio: Date;
  fin: Date;
  invitados: KickoffInvitee[];
  ubicaciones: KickoffUbicacionTipo[];
  salaVerytel: KickoffSalaVerytel | null;
  ubicacionDetalle: string;
}): SlotValidation {
  const conflicts: string[] = [];
  const skipped: string[] = [];
  const start = toHourFloat(params.inicio);
  const end = toHourFloat(params.fin);
  const dayIndex = (params.inicio.getDay() + 6) % 7;
  if (dayIndex > 4) {
    return { ok: false, conflicts: ['Seleccione un día hábil (lun–vie).'], skipped };
  }

  if (params.ubicaciones.length === 0) {
    return {
      ok: false,
      conflicts: ['Seleccione al menos una ubicación (Teams y/o Presencial).'],
      skipped,
    };
  }

  const grid = buildAvailabilityGrid({
    weekAnchor: params.inicio,
    invitados: params.invitados,
    salaVerytel:
      params.ubicaciones.includes('Presencial') && params.salaVerytel
        ? params.salaVerytel
        : null,
    proposedStart: params.inicio,
    proposedEnd: params.fin,
  });

  for (const inv of params.invitados) {
    if (inv.tipo === 'Externo') {
      skipped.push(`${inv.nombre} — agenda externa (sin validación)`);
      continue;
    }
    const personBlocks = grid.filter(
      (b) => b.resourceId === inv.id && b.tone !== 'proposed',
    );
    for (const b of personBlocks) {
      if (
        b.dayIndex === dayIndex &&
        overlaps(start, end, b.startHour, b.endHour)
      ) {
        conflicts.push(`${inv.nombre} ocupado ${Math.floor(b.startHour)}:00–${Math.floor(b.endHour)}:00`);
      }
    }
  }

  if (params.ubicaciones.includes('Presencial')) {
    if (params.salaVerytel) {
      const roomBlocks = grid.filter(
        (b) => b.resourceId === params.salaVerytel && b.tone === 'room',
      );
      for (const b of roomBlocks) {
        if (
          b.dayIndex === dayIndex &&
          overlaps(start, end, b.startHour, b.endHour)
        ) {
          conflicts.push(`${params.salaVerytel} no disponible en ese horario`);
          break;
        }
      }
    } else if (params.ubicacionDetalle.trim()) {
      skipped.push('Ubicación presencial fuera de Verytel — sin validación de sala');
    }
  }

  return { ok: conflicts.length === 0, conflicts, skipped };
}

export function mockTeamsMeetingLink(nombre: string): string {
  const slug = nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  return `https://teams.microsoft.com/meet/${slug}-${Date.now().toString(36)}`;
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
  const t1 = a.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const t2 = b.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${t1} – ${t2}`;
}

export { DAY_LABELS };
