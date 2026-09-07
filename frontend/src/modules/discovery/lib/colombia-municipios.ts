import { COLOMBIA_MUNICIPIOS_DATA } from './colombia-municipios.data';

export type ColombiaMunicipio = {
  municipio: string;
  departamento: string;
};

export const COLOMBIA_MUNICIPIOS: ColombiaMunicipio[] = [
  ...COLOMBIA_MUNICIPIOS_DATA,
];

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/** Search municipalities by name (accent-insensitive). */
export function searchColombiaMunicipios(
  query: string,
  limit = 12,
): ColombiaMunicipio[] {
  const q = normalize(query);
  if (!q) return COLOMBIA_MUNICIPIOS.slice(0, limit);
  const starts: ColombiaMunicipio[] = [];
  const contains: ColombiaMunicipio[] = [];
  for (const row of COLOMBIA_MUNICIPIOS) {
    const name = normalize(row.municipio);
    if (name.startsWith(q)) starts.push(row);
    else if (name.includes(q)) contains.push(row);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

export function findColombiaMunicipio(
  municipio: string,
  departamento?: string,
): ColombiaMunicipio | undefined {
  const m = normalize(municipio);
  const d = departamento ? normalize(departamento) : '';
  return COLOMBIA_MUNICIPIOS.find((row) => {
    if (normalize(row.municipio) !== m) return false;
    if (d && normalize(row.departamento) !== d) return false;
    return true;
  });
}
