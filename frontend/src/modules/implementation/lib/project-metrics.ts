// Helpers de formato para el detalle SER (diseño Design_JD). Los cálculos
// de indicadores no viven aquí: los hace el PMO y el CRM solo los muestra.

export function formatCop(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatIsoDate(value: string | null | undefined): string {
  if (!value) return '—';
  // `YYYY-MM-DD` se lee como fecha local: con `new Date()` saldría en UTC y
  // en Colombia mostraría el día anterior.
  const ymd = parseYmd(value);
  if (ymd) return ymd.toLocaleDateString('es-CO');
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value.slice(0, 10) || '—';
  }
  return d.toLocaleDateString('es-CO');
}

export function toYmd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseYmd(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isoWeekFromDate(date: Date): string {
  const utc = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function isoWeekFromYmd(ymd: string): string {
  const date = parseYmd(ymd);
  return date ? isoWeekFromDate(date) : '';
}

export function currentIsoWeek(): string {
  return isoWeekFromDate(new Date());
}
