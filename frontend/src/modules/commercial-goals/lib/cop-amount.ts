import { formatAmountEsCo } from '../../../lib/format';

const THOUSANDS = /\B(?=(\d{3})+(?!\d))/g;

/** Digits only, grouped with es-CO thousands separators while typing. */
export function formatCopIntegerInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits.replace(THOUSANDS, '.');
}

export function parseCopInteger(formatted: string): number | null {
  const digits = formatted.replace(/\./g, '').trim();
  if (!/^[1-9]\d*$/.test(digits)) return null;
  const value = Number(digits);
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  return value;
}

/** `$ 1.200.000.000` */
export function formatCopDisplay(value: string | number | null | undefined): string {
  const formatted = formatAmountEsCo(value);
  return formatted ? `$ ${formatted}` : '—';
}

function formatEs(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(value);
}

/**
 * Magnitude hint so a missed zero is obvious.
 * 1.200.000.000 → "1.200 millones" (the dot is the es-CO thousands separator).
 */
export function abbreviateCop(amount: number): string {
  if (!Number.isSafeInteger(amount) || amount <= 0) return '';
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    if (millions === 1) return '1 millón';
    return `${formatEs(millions)} millones`;
  }
  if (amount >= 1_000) {
    return `${formatEs(amount / 1_000)} mil`;
  }
  return formatEs(amount);
}
