export const MAX_CITA_CONTACTOS = 8;

export type CitaContacto = {
  nombre: string;
  email: string;
  telefono: string;
};

export function normalizeCitaContactos(raw: unknown): CitaContacto[] {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) {
    return [];
  }

  const result: CitaContacto[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const row = item as { nombre?: unknown; email?: unknown; telefono?: unknown };
    const nombre = String(row.nombre ?? '').trim();
    const email = String(row.email ?? '').trim();
    const telefono = String(row.telefono ?? '').trim();
    if (!nombre && !email && !telefono) {
      continue;
    }
    result.push({ nombre, email, telefono });
    if (result.length >= MAX_CITA_CONTACTOS) {
      break;
    }
  }
  return result;
}

export function isCompleteCitaContacto(contacto: CitaContacto): boolean {
  return Boolean(contacto.nombre && contacto.email && contacto.telefono);
}
