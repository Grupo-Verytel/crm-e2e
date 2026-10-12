export type UnionTemporal = {
  id: string;
  nit: string;
  nombre: string;
};

const STORAGE_KEY = 'crm-uniones-temporales-v1';

const SEED: UnionTemporal[] = [
  {
    id: 'ut-perimetral-caribe',
    nit: '901234567-1',
    nombre: 'UT Perimetral Caribe',
  },
];

function readAll(): UnionTemporal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
      return [...SEED];
    }
    const parsed = JSON.parse(raw) as UnionTemporal[];
    return Array.isArray(parsed) ? parsed : [...SEED];
  } catch {
    return [...SEED];
  }
}

function writeAll(rows: UnionTemporal[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function listUnionesTemporales(): UnionTemporal[] {
  return readAll().slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export function createUnionTemporal(input: {
  nit: string;
  nombre: string;
}): UnionTemporal {
  const nit = input.nit.trim();
  const nombre = input.nombre.trim();
  if (!nit) {
    throw new Error('NIT requerido');
  }
  if (!nombre) {
    throw new Error('Nombre requerido');
  }
  const existing = readAll();
  const nitKey = nit.replace(/\s+/g, '').toLowerCase();
  if (
    existing.some((row) => row.nit.replace(/\s+/g, '').toLowerCase() === nitKey)
  ) {
    throw new Error('Ya existe una unión temporal con ese NIT');
  }
  const created: UnionTemporal = {
    id: crypto.randomUUID(),
    nit,
    nombre,
  };
  writeAll([...existing, created]);
  return created;
}
