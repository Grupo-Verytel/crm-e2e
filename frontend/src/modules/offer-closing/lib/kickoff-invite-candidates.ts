import { fetchPeople } from '../../accounts/api/accounts-api';
import { fetchOuvContactos } from '../../discovery/api/ouvs-api';
import type { KickoffInviteeTipo } from '../../shared/project/types';
import { KICKOFF_COMPANY_USERS } from './kickoff-scheduling';

export type KickoffInviteCandidate = {
  id: string;
  nombre: string;
  email: string;
  tipo: KickoffInviteeTipo;
  origenLabel: string;
};

export async function loadKickoffInviteCandidates(options: {
  ouvId: string;
  accountId?: string | null;
  empresaNombre?: string | null;
}): Promise<KickoffInviteCandidate[]> {
  const map = new Map<string, KickoffInviteCandidate>();
  for (const u of KICKOFF_COMPANY_USERS) {
    map.set(u.email.toLowerCase(), {
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      tipo: 'Interno',
      origenLabel: u.empresa,
    });
  }
  try {
    if (options.accountId) {
      const people = await fetchPeople({
        account_id: options.accountId,
        page: 1,
        limit: 100,
      });
      for (const p of people.items) {
        const email =
          p.email?.trim().toLowerCase() || `${p.person_id}@cuenta.local`;
        if (map.has(email)) continue;
        map.set(email, {
          id: p.person_id,
          nombre: p.name,
          email: p.email ?? email,
          tipo: 'Externo',
          origenLabel: p.account_name ?? options.empresaNombre ?? 'Empresa OUV',
        });
      }
    }
  } catch {
    /* optional directory */
  }
  try {
    const contactos = await fetchOuvContactos(options.ouvId);
    for (const c of contactos) {
      const email =
        c.email?.trim().toLowerCase() ||
        `${c.contacto_ouv_id}@contacto.local`;
      if (map.has(email)) continue;
      map.set(email, {
        id: c.contacto_ouv_id,
        nombre: c.name,
        email: c.email ?? email,
        tipo: 'ContactoOuv',
        origenLabel: options.empresaNombre ?? 'Contacto OUV',
      });
    }
  } catch {
    /* optional directory */
  }
  return [...map.values()];
}

export function kickoffInviteeTipoLabel(tipo: KickoffInviteeTipo): string {
  if (tipo === 'Interno') return 'Verytel / Frisson';
  return 'Empresa OUV';
}
