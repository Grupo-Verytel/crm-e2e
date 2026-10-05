import { formatAmountEsCo } from '../../../lib/format';

/** Compact COP for donut centers (e.g. $45 M, $1.250 M, $850 mil). */
export function formatCompactCop(value: number): string {
  if (!Number.isFinite(value) || value === 0) {
    return '$0';
  }

  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    const formatted = millions.toLocaleString('es-CO', {
      maximumFractionDigits: millions >= 100 ? 0 : 1,
      minimumFractionDigits: 0,
    });
    return `${sign}$${formatted} M`;
  }

  if (abs >= 1_000) {
    const thousands = abs / 1_000;
    const formatted = thousands.toLocaleString('es-CO', {
      maximumFractionDigits: thousands >= 10 ? 0 : 1,
      minimumFractionDigits: 0,
    });
    return `${sign}$${formatted} mil`;
  }

  return `${sign}$${abs.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
}

export function formatCopAmount(
  value: string | number | null | undefined,
): string {
  const formatted = formatAmountEsCo(value);
  return formatted ? `$${formatted}` : '—';
}

export function ouvCountCaption(count: number): string {
  if (count === 1) return '1 OUV';
  return `${count} OUVs`;
}
