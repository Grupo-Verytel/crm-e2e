export type PersonInfluenciaTipo =
  | 'Economica'
  | 'Tecnica'
  | 'Fabrica'
  | 'Usuario'
  | 'Coach';

export const PERSON_INFLUENCIA_TIPOS: PersonInfluenciaTipo[] = [
  'Economica',
  'Tecnica',
  'Fabrica',
  'Usuario',
  'Coach',
];

const STORAGE_PREFIX = 'crm-person-influencia-tipo-';

export function loadPersonInfluenciaTipo(
  personId: string,
): PersonInfluenciaTipo | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${personId}`);
    if (!raw) return null;
    if (PERSON_INFLUENCIA_TIPOS.includes(raw as PersonInfluenciaTipo)) {
      return raw as PersonInfluenciaTipo;
    }
    return null;
  } catch {
    return null;
  }
}

export function savePersonInfluenciaTipo(
  personId: string,
  tipo: PersonInfluenciaTipo | null,
): void {
  const key = `${STORAGE_PREFIX}${personId}`;
  if (!tipo) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, tipo);
}
