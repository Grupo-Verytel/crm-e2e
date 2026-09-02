import { createHmac, timingSafeEqual } from 'crypto';
import { ServiceHorizon } from './enums';

/**
 * Cursor opaco de paginación — §6.1.
 *
 * INV-03: codifica la clave de orden total `(source_created_at, id)` y va
 * firmado con HMAC-SHA256. Es exclusivo: la página siguiente arranca
 * estrictamente después del último elemento entregado. Se prohíbe OFFSET.
 * Retención declarada: 7 días (`CURSOR_TTL_MS`); vencido → 400 CURSOR_EXPIRED.
 */

export const CURSOR_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CursorPayload {
  /** `source_created_at` del último elemento entregado, en ms epoch. */
  t: number;
  /** `id` del último elemento entregado. */
  i: string;
  /** Filtro `service_horizon` con el que se emitió, o `null`. */
  h: ServiceHorizon | null;
  /** Instante de emisión, en ms epoch — base de la expiración. */
  iat: number;
}

export class CursorExpiredError extends Error {}
export class CursorInvalidError extends Error {}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('base64url');
}

export function encodeCursor(
  payload: Omit<CursorPayload, 'iat'>,
  secret: string,
  now: Date = new Date(),
): string {
  const full: CursorPayload = { ...payload, iat: now.getTime() };
  const body = Buffer.from(JSON.stringify(full), 'utf8').toString('base64url');
  return `${body}.${sign(body, secret)}`;
}

export function decodeCursor(
  cursor: string,
  secret: string,
  now: Date = new Date(),
): CursorPayload {
  const separator = cursor.lastIndexOf('.');
  if (separator <= 0) {
    throw new CursorInvalidError('Cursor sin firma');
  }

  const body = cursor.slice(0, separator);
  const signature = cursor.slice(separator + 1);
  const expected = sign(body, secret);

  const given = Buffer.from(signature, 'utf8');
  const want = Buffer.from(expected, 'utf8');
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    throw new CursorInvalidError('Firma de cursor inválida');
  }

  let payload: CursorPayload;
  try {
    payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as CursorPayload;
  } catch {
    throw new CursorInvalidError('Cursor no decodificable');
  }

  if (
    typeof payload?.t !== 'number' ||
    typeof payload?.i !== 'string' ||
    typeof payload?.iat !== 'number'
  ) {
    throw new CursorInvalidError('Cursor con estructura inválida');
  }

  if (now.getTime() - payload.iat > CURSOR_TTL_MS) {
    throw new CursorExpiredError('Cursor fuera de la ventana de 7 días');
  }

  return payload;
}
