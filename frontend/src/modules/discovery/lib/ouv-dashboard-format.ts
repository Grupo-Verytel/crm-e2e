/** Compact money for dashboard KPIs (e.g. $10,5 M). */
export function formatCompactMoney(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '$0';
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

export function formatRate(rate: number | null): string {
  if (rate == null) return '—';
  return `${Math.round(rate * 100)}%`;
}

export function formatPeriodDate(ymd: string | null): string {
  if (!ymd) return '';
  const [year, month, day] = ymd.split('-').map(Number);
  if (!year || !month || !day) return ymd;
  return new Date(year, month - 1, day).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
