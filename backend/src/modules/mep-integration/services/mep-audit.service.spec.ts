import { createHash } from 'crypto';
import { redact } from './mep-audit.service';

const sha = (value: string) =>
  createHash('sha256').update(value, 'utf8').digest('hex');

describe('redacción de la auditoría — §12.3', () => {
  it('INV-31 / TS-AUD-06: `source_content` se guarda como {sha256, length}, nunca en claro', () => {
    const content = 'Contenido humano original de la interacción.';

    const result = redact({
      crm_interaction_ref: 'int_20004',
      source_content: content,
    }) as Record<string, unknown>;

    expect(result.source_content).toEqual({
      sha256: sha(content),
      length: content.length,
    });
    expect(JSON.stringify(result)).not.toContain(content);
  });

  it('INV-31: la redacción alcanza cualquier nivel de anidamiento', () => {
    const result = redact({
      before: { interaction: { source_content: 'texto' } },
    }) as Record<string, Record<string, Record<string, unknown>>>;

    expect(result.before.interaction.source_content).toEqual({
      sha256: sha('texto'),
      length: 5,
    });
  });

  it('INV-31 / TS-SEC-09: el valor de la API key nunca llega al audit_log', () => {
    const result = redact({
      headers: {
        'x-api-key': 'mep_production_supersecreto',
        authorization: 'Bearer abc',
        'x-correlation-id': 'corr_1',
      },
    }) as Record<string, Record<string, unknown>>;

    expect(result.headers).not.toHaveProperty('x-api-key');
    expect(result.headers).not.toHaveProperty('authorization');
    expect(result.headers['x-correlation-id']).toBe('corr_1');
    expect(JSON.stringify(result)).not.toContain('supersecreto');
  });

  it('§12.1: los estados sin redactar se preservan tal cual', () => {
    const state = {
      response_id: 'mep:int_20004:response',
      response_version: 3,
      route_capacity: { version: 'V1' },
      service_results: [{ service: 'TECHNICAL_DESIGN', outcome: null }],
    };

    expect(redact(state)).toEqual(state);
  });

  it('§12.1: `undefined` se normaliza a null para poder persistirse como JSON', () => {
    expect(redact(undefined)).toBeNull();
  });
});
