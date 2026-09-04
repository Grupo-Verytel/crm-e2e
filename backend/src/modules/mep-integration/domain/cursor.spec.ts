import {
  CURSOR_TTL_MS,
  CursorExpiredError,
  CursorInvalidError,
  decodeCursor,
  encodeCursor,
} from './cursor';
import { ServiceHorizon } from './enums';

const SECRET = 'secreto-de-prueba-para-el-cursor';

describe('cursor opaco de intake — §6.1', () => {
  it('INV-03: codifica y recupera la clave de orden (source_created_at, id)', () => {
    const issuedAt = new Date('2026-08-21T14:37:12Z');
    const cursor = encodeCursor(
      { t: Date.parse('2026-08-21T14:36:00Z'), i: '42', h: null },
      SECRET,
      issuedAt,
    );

    const decoded = decodeCursor(cursor, SECRET, issuedAt);

    expect(decoded.t).toBe(Date.parse('2026-08-21T14:36:00Z'));
    expect(decoded.i).toBe('42');
    expect(decoded.h).toBeNull();
  });

  it('AC-01: el cursor es opaco — no expone la clave de orden en claro', () => {
    const cursor = encodeCursor(
      { t: Date.parse('2026-08-21T14:36:00Z'), i: '42', h: null },
      SECRET,
    );

    expect(cursor).not.toContain('2026-08-21');
    expect(cursor).not.toContain('source_created_at');
  });

  it('TS-INT-06: un cursor manipulado falla la firma → INVALID_CURSOR', () => {
    const cursor = encodeCursor(
      { t: Date.now(), i: '42', h: ServiceHorizon.IMMEDIATE },
      SECRET,
    );
    const [body, signature] = cursor.split('.');
    const tampered = `${Buffer.from(
      JSON.stringify({ t: 0, i: '1', h: null, iat: Date.now() }),
      'utf8',
    ).toString('base64url')}.${signature}`;

    expect(body).toBeDefined();
    expect(() => decodeCursor(tampered, SECRET)).toThrow(CursorInvalidError);
  });

  it('TS-INT-06: un cursor firmado con otra clave no verifica', () => {
    const cursor = encodeCursor(
      { t: Date.now(), i: '1', h: null },
      'otra-clave',
    );

    expect(() => decodeCursor(cursor, SECRET)).toThrow(CursorInvalidError);
  });

  it('TS-INT-07: un cursor de 8 días está expirado → CURSOR_EXPIRED', () => {
    const issuedAt = new Date('2026-08-13T00:00:00Z');
    const cursor = encodeCursor(
      { t: Date.now(), i: '1', h: null },
      SECRET,
      issuedAt,
    );

    const eightDaysLater = new Date(issuedAt.getTime() + 8 * 24 * 3600 * 1000);

    expect(() => decodeCursor(cursor, SECRET, eightDaysLater)).toThrow(
      CursorExpiredError,
    );
  });

  it('AC-01: la retención declarada del cursor es de 7 días', () => {
    expect(CURSOR_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);

    const issuedAt = new Date('2026-08-13T00:00:00Z');
    const cursor = encodeCursor(
      { t: Date.now(), i: '1', h: null },
      SECRET,
      issuedAt,
    );
    const justInside = new Date(issuedAt.getTime() + CURSOR_TTL_MS - 1000);

    expect(() => decodeCursor(cursor, SECRET, justInside)).not.toThrow();
  });

  it('INV-05: el mismo cursor decodifica siempre al mismo punto de corte', () => {
    const cursor = encodeCursor(
      { t: Date.parse('2026-08-21T14:36:00Z'), i: '42', h: null },
      SECRET,
    );

    expect(decodeCursor(cursor, SECRET)).toEqual(decodeCursor(cursor, SECRET));
  });
});
