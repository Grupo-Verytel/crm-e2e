import { createHash } from 'crypto';

/**
 * Canonicalización JSON (JCS, RFC 8785) — §9.1 paso 2.
 *
 * Se usa para `request_hash` de idempotencia y para `payload_hash` de las
 * entidades append-only. Requisito TS-IDEM-06: reordenar las claves del payload
 * produce el mismo hash (replay, no 409).
 *
 * Reglas aplicadas:
 *  - Claves de objeto ordenadas por sus unidades de código UTF-16.
 *  - Sin espacios en blanco insignificantes.
 *  - Números serializados con el algoritmo `Number::toString` de ECMAScript.
 *  - Cadenas con el escapado mínimo de JSON.
 */
export function canonicalize(value: unknown): string {
  return serialize(value);
}

function serialize(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  const type = typeof value;

  if (type === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (type === 'number') {
    const num = value as number;
    if (!Number.isFinite(num)) {
      throw new TypeError('JCS: NaN e Infinity no son serializables');
    }
    // JCS delega en Number::toString de ECMAScript; `-0` se emite como `0`.
    return Object.is(num, -0) ? '0' : String(num);
  }

  if (type === 'bigint') {
    return (value as bigint).toString();
  }

  if (type === 'string') {
    return escapeString(value as string);
  }

  if (Array.isArray(value)) {
    // El orden de los arrays es significativo: se preserva.
    return `[${value.map((item) => serialize(item)).join(',')}]`;
  }

  if (type === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined,
    );
    entries.sort(([a], [b]) => compareUtf16(a, b));
    return `{${entries
      .map(([key, val]) => `${escapeString(key)}:${serialize(val)}`)
      .join(',')}}`;
  }

  throw new TypeError(`JCS: tipo no serializable (${type})`);
}

/** Orden lexicográfico por unidades de código UTF-16, como exige RFC 8785. */
function compareUtf16(a: string, b: string): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const diff = a.charCodeAt(i) - b.charCodeAt(i);
    if (diff !== 0) {
      return diff;
    }
  }
  return a.length - b.length;
}

const ESCAPES: Record<string, string> = {
  '"': '\\"',
  '\\': '\\\\',
  '\b': '\\b',
  '\f': '\\f',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
};

function escapeString(input: string): string {
  let out = '"';
  for (const char of input) {
    const escape = ESCAPES[char];
    if (escape !== undefined) {
      out += escape;
      continue;
    }
    const code = char.codePointAt(0) as number;
    if (code < 0x20) {
      out += `\\u${code.toString(16).padStart(4, '0')}`;
      continue;
    }
    out += char;
  }
  return `${out}"`;
}

/** sha256 hex del payload canonicalizado (JCS). */
export function canonicalHash(value: unknown): string {
  return createHash('sha256').update(canonicalize(value), 'utf8').digest('hex');
}

/** sha256 hex de una cadena arbitraria. */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
