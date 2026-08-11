import type { LeadContact } from '../types';

export function contactPersonName(contact: LeadContact): string {
  return contact.name ?? contact.nombre ?? '—';
}

export function contactJobTitle(contact: LeadContact): string | null {
  return contact.job_title ?? contact.cargo ?? null;
}

export function contactEmail(contact: LeadContact): string | null {
  return contact.email ?? null;
}

export function contactPhone(contact: LeadContact): string | null {
  return contact.phone ?? contact.telefono ?? null;
}

export function contactAccountName(
  contact: LeadContact,
  fallback?: string,
): string {
  return contact.account_name ?? contact.empresa_nombre ?? fallback ?? '—';
}
