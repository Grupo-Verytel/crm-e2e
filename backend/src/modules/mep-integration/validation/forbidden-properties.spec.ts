import {
  FORBIDDEN_PROPERTY_NAMES,
  findForbiddenProperties,
} from './forbidden-properties';

describe('frontera LEAN — §7.4', () => {
  it('TS-LEAN-01 / INV-24: `evidence_url` y `process_evidence` se detectan', () => {
    const findings = findForbiddenProperties({
      response_id: 'mep:int_20004:response',
      evidence_url: 'https://algo',
      process_evidence: { any: 1 },
    });

    expect(findings.map((f) => f.pointer)).toEqual([
      '/evidence_url',
      '/process_evidence',
    ]);
    expect(findings.every((f) => f.code === 'UNKNOWN_PROPERTY')).toBe(true);
  });

  it('TS-LEAN-02 / INV-25: ningún identificador interno de MEP cruza el contrato', () => {
    const payload = {
      excel_row_id: 1,
      event_id: 2,
      snapshot_id: 3,
      cut_id: 4,
      delivery_attempt: 5,
      archetype_lane: 'B2G',
    };

    expect(findForbiddenProperties(payload)).toHaveLength(6);
  });

  it('INV-19: `interaction_type` está en la lista negra', () => {
    expect(FORBIDDEN_PROPERTY_NAMES).toContain('interaction_type');
    expect(findForbiddenProperties({ interaction_type: 'X' })).toHaveLength(1);
  });

  it('INV-27: `delivery_attempt` anidado dentro de un array se detecta con su puntero', () => {
    const findings = findForbiddenProperties({
      service_results: [
        { service: 'TECHNICAL_DESIGN' },
        { service: 'FINANCIAL_DESIGN', delivery_attempt: 3 },
      ],
    });

    expect(findings).toEqual([
      {
        pointer: '/service_results/1/delivery_attempt',
        code: 'UNKNOWN_PROPERTY',
      },
    ]);
  });

  it('§7.4: la detección es insensible a mayúsculas', () => {
    expect(findForbiddenProperties({ Evidence_URL: 'x' })).toHaveLength(1);
  });

  it('§7.4: `delivered_interaction_type` no se confunde con `interaction_type`', () => {
    // La lista negra compara nombres exactos, no subcadenas: el campo de
    // clasificación al cierre es parte legítima del contrato (§6.5).
    expect(
      findForbiddenProperties({ delivered_interaction_type: 'DISENO_TECNICO' }),
    ).toEqual([]);
  });

  it('un payload limpio del contrato no produce hallazgos', () => {
    expect(
      findForbiddenProperties({
        response_id: 'mep:int_20004:response',
        response_version: 3,
        service_results: [
          { service: 'TECHNICAL_DESIGN', dependency: 'NONE', deliverables: [] },
        ],
      }),
    ).toEqual([]);
  });
});
