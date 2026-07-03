export function buildQueryString(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 30],
  ['month', 12],
  ['year', Number.POSITIVE_INFINITY],
];

/**
 * Relative, human phrasing for a past/future timestamp (e.g. "hace 3 días").
 * Used in dense lists where an absolute date is noise; falls back to "—".
 */
export function formatRelative(value: string | null): string {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value).getTime();
  if (Number.isNaN(parsed)) {
    return '—';
  }

  const formatter = new Intl.RelativeTimeFormat('es-CO', { numeric: 'auto' });
  let delta = (parsed - Date.now()) / 1000;

  for (const [unit, limit] of RELATIVE_STEPS) {
    if (Math.abs(delta) < limit) {
      return formatter.format(Math.round(delta), unit);
    }
    delta /= limit;
  }

  return formatter.format(Math.round(delta), 'year');
}
