import type { LeadContact, LeadInfluenciaTipo } from '../types';

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

const INFLUENCIA_CANONICAL: Record<string, LeadInfluenciaTipo> = {
  Economica: 'Economica',
  Tecnica: 'Tecnica',
  Fabrica: 'Fabrica',
  Usuario: 'Usuario',
  Coach: 'Coach',
  DeFabrica: 'Fabrica',
  Usuaria: 'Usuario',
  economica: 'Economica',
  tecnica: 'Tecnica',
  fabrica: 'Fabrica',
  usuario: 'Usuario',
  coach: 'Coach',
  defabrica: 'Fabrica',
  usuaria: 'Usuario',
};

/** Reads the contact role from either API casing and legacy aliases. */
export function contactInfluenciaTipo(
  contact: LeadContact & { tipoInfluencia?: string | null },
): LeadInfluenciaTipo | null {
  const raw = contact.tipo_influencia ?? contact.tipoInfluencia ?? null;
  if (!raw) {
    return null;
  }
  return INFLUENCIA_CANONICAL[raw] ?? INFLUENCIA_CANONICAL[raw.toLowerCase()] ?? null;
}
