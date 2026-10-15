/**
 * NIT colombiano con dígito de verificación (DV) calculado según la DIAN.
 *
 * Se guarda partido: la base (solo dígitos) y el DV por separado. Así la
 * unicidad no depende de cómo lo escribió el usuario («900.123.456-7»,
 * «900123456 - 7»…).
 */

/** Pesos de la DIAN, aplicados de derecha a izquierda sobre la base. */
const PESOS_DIAN = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

/** Cédulas cortas (personas naturales) hasta NIT de 15 dígitos. */
const BASE_MIN = 6;
const BASE_MAX = PESOS_DIAN.length;

export type NitPartido = { base: string; dv: string };

export function calcularDvNit(base: string): string {
  const digitos = base.split('').reverse();
  const suma = digitos.reduce(
    (acc, digito, i) => acc + Number(digito) * PESOS_DIAN[i],
    0,
  );
  const residuo = suma % 11;
  return String(residuo > 1 ? 11 - residuo : residuo);
}

/**
 * Separa y valida un NIT escrito como `base-DV`. Admite puntos y espacios.
 * Devuelve `null` si el formato no es válido o el DV no corresponde.
 *
 * El guion es obligatorio: sin él no se sabe si el último dígito es el DV o
 * parte de la base.
 */
export function parseNit(raw: string): NitPartido | null {
  const limpio = raw.replace(/[\s.]/g, '');
  const match = /^(\d+)-(\d)$/.exec(limpio);
  if (!match) return null;
  const [, base, dv] = match;
  if (base.length < BASE_MIN || base.length > BASE_MAX) return null;
  if (calcularDvNit(base) !== dv) return null;
  return { base, dv };
}

export function formatNit(base: string, dv: string): string {
  return `${base}-${dv}`;
}
