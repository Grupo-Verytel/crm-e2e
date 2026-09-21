export const MAX_CITA_CONTACTOS = 8;

export type CitaContactoInput = {
  nombre: string;
  email: string;
  telefono: string;
};

export function emptyCitaContacto(): CitaContactoInput {
  return { nombre: '', email: '', telefono: '' };
}

export function parseCitaContactos(raw: unknown): CitaContactoInput[] {
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
  const result: CitaContactoInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const row = item as {
      nombre?: unknown;
      email?: unknown;
      telefono?: unknown;
    };
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

export function formatCitaContactosLabel(
  contactos: CitaContactoInput[],
): string {
  const names = contactos
    .map((contacto) => contacto.nombre)
    .filter(Boolean);
  if (names.length === 0) {
    return '';
  }
  if (names.length <= 2) {
    return names.join(', ');
  }
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}
