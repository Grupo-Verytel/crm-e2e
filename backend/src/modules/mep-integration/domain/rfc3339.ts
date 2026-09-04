/**
 * Serialización de fechas del contrato — §6.
 *
 * Todos los `date-time` en UTC, RFC 3339, sufijo `Z`, precisión de segundos o
 * milisegundos. Se emiten milisegundos solo cuando existen, de modo que el
 * valor que MEP envió vuelve idéntico en el `GET` post-write (INV-15).
 */
export function toRfc3339(
  value: Date | string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const iso = date.toISOString(); // siempre `YYYY-MM-DDTHH:mm:ss.sssZ`
  return date.getUTCMilliseconds() === 0 ? `${iso.slice(0, 19)}Z` : iso;
}

/** `YYYY-MM-DD` tal como lo devuelve una columna DATE de MySQL. */
export function toDateOnly(
  value: Date | string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}
