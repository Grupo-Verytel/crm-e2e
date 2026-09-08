import fs from 'fs';

const src = process.argv[2];
const dest = process.argv[3];
const raw = JSON.parse(fs.readFileSync(src, 'utf8'));

const LOWER = new Set([
  'de',
  'del',
  'la',
  'las',
  'los',
  'y',
  'e',
  'el',
]);

function titleWord(word, index) {
  const lower = word.toLocaleLowerCase('es-CO');
  if (lower === 'd.c.') return 'D.C.';
  if (index > 0 && LOWER.has(lower)) return lower;
  return lower.replace(/^\S/u, (c) => c.toLocaleUpperCase('es-CO'));
}

function title(s) {
  return String(s || '')
    .trim()
    .split(/(\s+|[-'])/)
    .map((part, i, arr) => {
      if (/^\s+$/.test(part) || part === '-' || part === "'") return part;
      // Count only real words for LOWER-word rule
      const wordIndex = arr
        .slice(0, i)
        .filter((p) => p && !/^\s+$/.test(p) && p !== '-' && p !== "'").length;
      return titleWord(part, wordIndex);
    })
    .join('');
}

const rows = raw
  .map((r) => ({
    municipio: title(r.nom_mpio),
    departamento: title(r.dpto),
  }))
  .filter((r) => r.municipio && r.departamento);

rows.sort(
  (a, b) =>
    a.municipio.localeCompare(b.municipio, 'es') ||
    a.departamento.localeCompare(b.departamento, 'es'),
);

const body =
  'export const COLOMBIA_MUNICIPIOS_DATA: { municipio: string; departamento: string }[] = ' +
  JSON.stringify(rows) +
  ';\n';

fs.writeFileSync(dest, body, 'utf8');
const samples = [
  rows.find((x) => x.municipio === 'Medellín'),
  rows.find((x) => x.municipio.startsWith('Bogotá')),
  rows.find((x) => x.departamento.includes('Norte')),
];
console.log(rows.length, JSON.stringify(samples));
