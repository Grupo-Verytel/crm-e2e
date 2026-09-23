import {
  contactEmail,
  contactJobTitle,
  contactPersonName,
  contactPhone,
} from '../../demand-generation/lib/contact-display';
import type { LeadContact } from '../../demand-generation/types';
import type { KickoffInvitee } from '../../shared/project/types';
import {
  buildAvailabilityGrid,
  validateKickoffSlot,
  type SlotValidation,
} from '../../offer-closing/lib/kickoff-scheduling';

export type SqlUbicacionTipo = 'Teams' | 'Presencial';

export type MeetingContactDraft = {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  cargo: string;
  descripcion: string;
};

export const SQL_DURACION_OPTIONS = [30, 45, 60, 90] as const;

export function createContactId(): string {
  return `contact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function leadContactsToDrafts(
  contacts: LeadContact[],
): MeetingContactDraft[] {
  if (contacts.length === 0) return [];

  return contacts.map((contact) => ({
    id: createContactId(),
    nombre: contactPersonName(contact),
    email: contactEmail(contact) ?? '',
    telefono: contactPhone(contact) ?? '',
    cargo: contactJobTitle(contact) ?? '',
    descripcion: '',
  }));
}

export function combineSameDay(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dateFromIso(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function timeFromIso(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function addMinutesToTime(date: string, time: string, minutes: number): string {
  const start = combineSameDay(date, time);
  if (!start) return time;
  start.setMinutes(start.getMinutes() + minutes);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(start.getHours())}:${pad(start.getMinutes())}`;
}

export function formatSqlAppointmentRange(
  fecha: string,
  horaInicio: string,
  horaFin: string,
): string {
  const inicio = combineSameDay(fecha, horaInicio);
  const fin = combineSameDay(fecha, horaFin);
  if (!inicio || !fin) return '';
  const date = inicio.toLocaleDateString('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const t1 = inicio.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const t2 = fin.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${date}, ${t1} – ${t2}`;
}

export function formatLeadAppointmentHint(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function commercialAsInvitee(input: {
  userId: string;
  fullName: string;
  email?: string;
}): KickoffInvitee {
  return {
    id: input.userId,
    nombre: input.fullName,
    email: input.email ?? `${input.userId}@verytel.com`,
    tipo: 'Interno',
  };
}

export function validateCommercialSlot(params: {
  inicio: Date;
  fin: Date;
  invitado: KickoffInvitee;
  ubicacion: SqlUbicacionTipo;
  lugarDetalle: string;
}): SlotValidation {
  return validateKickoffSlot({
    inicio: params.inicio,
    fin: params.fin,
    invitados: [params.invitado],
    ubicaciones: [params.ubicacion],
    salaVerytel: null,
    ubicacionDetalle: params.lugarDetalle,
  });
}

export function buildCommercialWeekAnchor(fecha: string): Date {
  if (fecha) {
    const d = new Date(`${fecha}T12:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function resolveSqlLugar(
  ubicacion: SqlUbicacionTipo,
  lugarDetalle: string,
): string {
  if (ubicacion === 'Teams') {
    return lugarDetalle.trim() || 'Microsoft Teams';
  }
  return lugarDetalle.trim() || 'Presencial';
}

export function buildMeetingDescription(
  contacts: MeetingContactDraft[],
  generateTeams: boolean,
): string | undefined {
  const primary = contacts[0];
  const chunks: string[] = [];
  if (primary?.descripcion.trim()) {
    chunks.push(primary.descripcion.trim());
  }
  if (generateTeams) {
    chunks.push('Reunión generada en Microsoft Teams.');
  }
  const extras = contacts.slice(1).filter((c) => c.nombre.trim());
  if (extras.length > 0) {
    const lines = extras.map((c) => {
      const bits = [c.nombre.trim()];
      if (c.email.trim()) bits.push(c.email.trim());
      if (c.telefono.trim()) bits.push(c.telefono.trim());
      if (c.cargo.trim()) bits.push(c.cargo.trim());
      if (c.descripcion.trim()) bits.push(c.descripcion.trim());
      return bits.join(' · ');
    });
    chunks.push(`Contactos adicionales: ${lines.join('; ')}`);
  }
  return chunks.length > 0 ? chunks.join('\n\n') : undefined;
}

export { buildAvailabilityGrid };
