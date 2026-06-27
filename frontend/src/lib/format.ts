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
