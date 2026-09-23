import {
  contactEmail,
  contactJobTitle,
  contactPersonName,
  contactPhone,
} from '../../demand-generation/lib/contact-display';
import type { LeadContact } from '../../demand-generation/types';
import { zonedBogotaDate } from './cita-scheduling';

export type SqlUbicacionTipo = 'Teams' | 'Presencial';

export type MeetingContactDraft = {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  cargo: string;
};

export function createContactId(): string {
  return `contact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function leadContactsToDrafts(
  contacts: LeadContact[],
): MeetingContactDraft[] {
  return contacts.map((contact) => ({
    id: createContactId(),
    nombre:
      contactPersonName(contact) === '—' ? '' : contactPersonName(contact),
    email: contactEmail(contact) ?? '',
    telefono: contactPhone(contact) ?? '',
    cargo: contactJobTitle(contact) ?? '',
  }));
}

export function addMinutesToTime(time: string, minutes: number): string {
  const [hour, minute] = time.slice(0, 5).split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return time.slice(0, 5);
  }
  const total = hour * 60 + minute + minutes;
  const nextHour = Math.floor(total / 60) % 24;
  const nextMinute = ((total % 60) + 60) % 60;
  return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`;
}

export function durationMinutesBetween(
  fecha: string,
  horaInicio: string,
  horaFin: string,
): number | null {
  if (!fecha || !horaInicio || !horaFin || horaFin <= horaInicio) {
    return null;
  }
  const start = zonedBogotaDate(fecha, horaInicio);
  const end = zonedBogotaDate(fecha, horaFin);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  if (minutes < 15 || minutes > 180) {
    return null;
  }
  return minutes;
}

export function formatSqlAppointmentRange(
  fecha: string,
  horaInicio: string,
  horaFin: string,
): string {
  if (!fecha || !horaInicio || !horaFin) {
    return '';
  }
  const start = zonedBogotaDate(fecha, horaInicio);
  const end = zonedBogotaDate(fecha, horaFin);
  const date = start.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const startLabel = start.toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
  });
  const endLabel = end.toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${date}, ${startLabel} – ${endLabel}`;
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
  contacts: Array<Pick<MeetingContactDraft, 'nombre' | 'email' | 'telefono' | 'cargo'>>,
): string | undefined {
  const extras = contacts.slice(1).filter((contact) => contact.nombre.trim());
  if (extras.length === 0) {
    return undefined;
  }
  const lines = extras.map((contact) => {
    const bits = [contact.nombre.trim()];
    if (contact.email.trim()) bits.push(contact.email.trim());
    if (contact.telefono.trim()) bits.push(contact.telefono.trim());
    if (contact.cargo.trim()) bits.push(contact.cargo.trim());
    return bits.join(' · ');
  });
  return `Contactos adicionales: ${lines.join('; ')}`;
}
