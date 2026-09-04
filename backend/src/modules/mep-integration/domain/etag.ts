/**
 * ETag del contrato — §6 y §8.
 *
 * Siempre fuerte (nunca `W/`) y entrecomillado. El §8 admite dos formas —
 * `"{recurso}-{version}"` o el sha256 canónico truncado; el contrato usa la
 * primera en los cuatro recursos, porque todos tienen una versión de origen
 * explícita y así el ETag es legible en logs y auditoría.
 *
 * INV-08: el `etag` del cuerpo y el header `ETag` son idénticos.
 */

export function resourceEtag(
  resource: string,
  version: string | number,
): string {
  return `"${resource}-${version}"`;
}

/**
 * Compara un header `If-Match` / `If-None-Match` contra el ETag actual.
 * Admite `*`, lista separada por comas y tolera el prefijo `W/` del cliente.
 */
export function etagMatches(headerValue: string, currentEtag: string): boolean {
  const candidates = headerValue
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (candidates.includes('*')) {
    return true;
  }

  const normalizedCurrent = stripWeak(currentEtag);
  return candidates.some(
    (candidate) => stripWeak(candidate) === normalizedCurrent,
  );
}

function stripWeak(value: string): string {
  return value.startsWith('W/') ? value.slice(2) : value;
}
