// Validación de NIT colombiano con dígito de verificación (DIAN).
//
// Copia de `backend/src/modules/offer-closing/lib/nit.ts` solo para avisar en
// el formulario antes de enviar; la regla que vale es la del backend.

const PESOS_DIAN = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
const BASE_MIN = 6;
const BASE_MAX = PESOS_DIAN.length;

export function calcularDvNit(base: string): string {
  const suma = base
    .split('')
    .reverse()
    .reduce((acc, digito, i) => acc + Number(digito) * PESOS_DIAN[i], 0);
  const residuo = suma % 11;
  return String(residuo > 1 ? 11 - residuo : residuo);
}

/** `null` si el NIT es válido; si no, el motivo para mostrar. */
export function errorNit(raw: string): string | null {
  const limpio = raw.replace(/[\s.]/g, '');
  if (!limpio) return 'NIT requerido';
  const match = /^(\d+)-(\d)$/.exec(limpio);
  if (!match) return 'Escribe el NIT como base-DV (ej. 900123456-7)';
  const [, base, dv] = match;
  if (base.length < BASE_MIN || base.length > BASE_MAX) {
    return `La base del NIT debe tener entre ${BASE_MIN} y ${BASE_MAX} dígitos`;
  }
  const esperado = calcularDvNit(base);
  if (esperado !== dv) {
    return `Dígito de verificación incorrecto: para ${base} es ${esperado}`;
  }
  return null;
}
