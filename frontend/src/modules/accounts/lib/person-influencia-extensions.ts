export type PersonInfluenciaTipo = 'Economica' | 'Tecnica' | 'Fabrica';

export const PERSON_INFLUENCIA_TIPOS: PersonInfluenciaTipo[] = [
  'Economica',
  'Tecnica',
  'Fabrica',
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

/**
 * Demo seed: assign Económica / Técnica / Fábrica to contacts missing a type
 * so OUV contact → influencia routing can be tested.
 */
export function ensureDemoPersonInfluencias(
  people: ReadonlyArray<{ person_id: string }>,
): number {
  let assigned = 0;
  people.forEach((person, index) => {
    if (loadPersonInfluenciaTipo(person.person_id)) return;
    savePersonInfluenciaTipo(
      person.person_id,
      PERSON_INFLUENCIA_TIPOS[index % PERSON_INFLUENCIA_TIPOS.length],
    );
    assigned += 1;
  });
  return assigned;
}
