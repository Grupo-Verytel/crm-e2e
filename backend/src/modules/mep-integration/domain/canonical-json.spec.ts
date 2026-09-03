import { canonicalHash, canonicalize } from './canonical-json';

describe('canonicalización JCS (RFC 8785) — §9.1', () => {
  it('TS-IDEM-06: reordenar las claves del payload produce el mismo request_hash', () => {
    const a = {
      response_id: 'mep:int_20004:response',
      response_version: 3,
      narrative_note: 'Ruta viable V1.',
    };
    const b = {
      narrative_note: 'Ruta viable V1.',
      response_version: 3,
      response_id: 'mep:int_20004:response',
    };

    expect(canonicalHash(a)).toBe(canonicalHash(b));
  });

  it('TS-IDEM-06: un cambio de contenido sí cambia el request_hash', () => {
    const base = { response_version: 3, narrative_note: 'V1' };
    const changed = { response_version: 3, narrative_note: 'V2' };

    expect(canonicalHash(base)).not.toBe(canonicalHash(changed));
  });

  it('ordena las claves por unidades de código UTF-16, no por locale', () => {
    expect(canonicalize({ b: 1, A: 2, a: 3 })).toBe('{"A":2,"a":3,"b":1}');
  });

  it('preserva el orden de los arrays: es significativo', () => {
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]');
  });

  it('escapa control chars y comillas sin re-encoding destructivo', () => {
    expect(canonicalize('a\nb"c\\d')).toBe('"a\\nb\\"c\\\\d"');
    expect(canonicalize('\u0001')).toBe('"\\u0001"');
  });

  it('INV-07: conserva emojis y acentos byte a byte', () => {
    const content = 'Diseño 🇨🇴 "técnico"\ncon salto';
    expect(JSON.parse(canonicalize(content))).toBe(content);
  });

  it('descarta `undefined` sin alterar los nulos significativos', () => {
    expect(canonicalize({ a: undefined, b: null })).toBe('{"b":null}');
  });
});
