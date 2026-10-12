export type Aliado = {
  id: string;
  nit: string;
  nombre: string;
};

const STORAGE_KEY = 'crm-aliados-v1';

function readAll(): Aliado[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Aliado[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows: Aliado[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function listAliados(): Aliado[] {
  return readAll().slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export function createAliado(input: { nit: string; nombre: string }): Aliado {
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
    throw new Error('Ya existe un aliado con ese NIT');
  }
  const created: Aliado = {
    id: crypto.randomUUID(),
    nit,
    nombre,
  };
  writeAll([...existing, created]);
  return created;
}
