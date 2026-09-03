import { ServiceHorizon, OpportunityStatus } from '../domain/enums';
import { CommercialInteraction, CommercialOpportunity } from '../models';
import {
  InteractionContract,
  presentInteraction,
  presentOpportunity,
} from './contract.presenter';

/**
 * Los presentadores son funciones puras sobre la forma del modelo, así que los
 * dobles de prueba solo necesitan las propiedades que se serializan.
 */
function interactionDouble(
  overrides: Partial<CommercialInteraction> = {},
): CommercialInteraction {
  return {
    crmInteractionRef: 'int_20004',
    crmOpportunityRef: 'ouv_9104',
    serviceHorizon: ServiceHorizon.IMMEDIATE,
    subject: 'Diseño técnico seguido de financiero',
    sourceContent: 'El modelo financiero inicia después del resultado técnico.',
    sourceCreatedAt: new Date('2026-08-21T14:36:00Z'),
    sourceVersion: '1',
    etag: '"int-20004-v1"',
    requestedServices: [
      {
        service: 'FINANCIAL_DESIGN',
        dependency: 'TECHNICAL_DESIGN',
        position: 1,
      },
      { service: 'TECHNICAL_DESIGN', dependency: 'NONE', position: 0 },
    ],
    ...overrides,
  } as unknown as CommercialInteraction;
}

function opportunityDouble(
  overrides: Partial<CommercialOpportunity> = {},
): CommercialOpportunity {
  return {
    crmOpportunityRef: 'ouv_9101',
    title: 'OUV de ejemplo para integración',
    organizationRef: 'org_4101',
    organizationName: 'Cliente de ejemplo',
    commercialAmount: '125000000',
    commercialCurrency: 'COP',
    stageRef: 'stage_design',
    stageName: 'Diseño de preventa',
    status: OpportunityStatus.OPEN,
    expectedCloseDate: '2026-09-30',
    commercialOwnerRef: 'commercial_17',
    commercialOwnerName: 'Ejecutivo Comercial',
    archetypeRef: 'arch_b2g_structured',
    archetypeName: 'B2G-ESTRUCTURADO',
    sourceVersion: '7',
    etag: '"ouv-9101-v7"',
    ...overrides,
  } as unknown as CommercialOpportunity;
}

describe('presentador de interacción — §4 / §6.1', () => {
  it('INV-06 / TS-INT-12: la representación no expone `interaction_type`', () => {
    const item = presentInteraction(interactionDouble());

    expect(Object.keys(item)).toEqual([
      'crm_interaction_ref',
      'crm_opportunity_ref',
      'service_horizon',
      'requested_services',
      'subject',
      'source_content',
      'source_created_at',
      'source_version',
      'etag',
    ]);
    expect(JSON.stringify(item)).not.toContain('interaction_type');
  });

  it('INV-07 / TS-INT-11: `source_content` sale byte a byte, con emojis, saltos y comillas', () => {
    const original = 'Línea 1\n"cita" 🇨🇴\tcon tab y \\ escapado';
    const item = presentInteraction(
      interactionDouble({ sourceContent: original }),
    );

    expect(item.source_content).toBe(original);
    const roundTripped = JSON.parse(
      JSON.stringify(item),
    ) as InteractionContract;
    expect(roundTripped.source_content).toBe(original);
  });

  it('§4: `requested_services[]` respeta el orden de `position`', () => {
    const item = presentInteraction(interactionDouble());

    expect(item.requested_services).toEqual([
      { service: 'TECHNICAL_DESIGN', dependency: 'NONE' },
      { service: 'FINANCIAL_DESIGN', dependency: 'TECHNICAL_DESIGN' },
    ]);
  });

  it('§6: los date-time salen en UTC RFC 3339 con sufijo Z', () => {
    const item = presentInteraction(interactionDouble());

    expect(item.source_created_at).toBe('2026-08-21T14:36:00Z');
  });

  it('INV-09: `crm_opportunity_ref` nulo se serializa como null, no se omite', () => {
    const item = presentInteraction(
      interactionDouble({ crmOpportunityRef: null }),
    );

    expect(item).toHaveProperty('crm_opportunity_ref');
    expect(item.crm_opportunity_ref).toBeNull();
  });
});

describe('presentador de oportunidad — §6.3', () => {
  it('TS-OUV-01: la OUV completa reproduce la forma del brief', () => {
    const ouv = presentOpportunity(
      opportunityDouble(),
      new Date('2026-08-21T14:31:20Z'),
    );

    expect(ouv).toEqual({
      crm_opportunity_ref: 'ouv_9101',
      title: 'OUV de ejemplo para integración',
      organization: { ref: 'org_4101', name: 'Cliente de ejemplo' },
      commercial_value: { amount: 125000000, currency: 'COP' },
      stage: { ref: 'stage_design', name: 'Diseño de preventa' },
      status: 'OPEN',
      expected_close_date: '2026-09-30',
      commercial_owner: {
        ref: 'commercial_17',
        display_name: 'Ejecutivo Comercial',
      },
      commercial_archetype: {
        ref: 'arch_b2g_structured',
        name: 'B2G-ESTRUCTURADO',
      },
      context_observed_at: '2026-08-21T14:31:20Z',
      source_version: '7',
      etag: '"ouv-9101-v7"',
    });
  });

  it('TS-OUV-02 / INV-09: con todos los opcionales vacíos, ninguna clave se omite', () => {
    const ouv = presentOpportunity(
      opportunityDouble({
        title: null,
        organizationRef: null,
        organizationName: null,
        commercialAmount: null,
        commercialCurrency: null,
        stageRef: null,
        stageName: null,
        status: null,
        expectedCloseDate: null,
        commercialOwnerRef: null,
        commercialOwnerName: null,
        archetypeRef: null,
        archetypeName: null,
      }),
    );

    for (const key of [
      'title',
      'organization',
      'commercial_value',
      'stage',
      'status',
      'expected_close_date',
      'commercial_owner',
      'commercial_archetype',
    ]) {
      expect(ouv).toHaveProperty(key);
      expect(ouv[key as keyof typeof ouv]).toBeNull();
    }
  });

  it('TS-OUV-03 / INV-10: `commercial_archetype` vacío es null, nunca {} ni ""', () => {
    const ouv = presentOpportunity(
      opportunityDouble({ archetypeRef: null, archetypeName: null }),
    );

    expect(ouv.commercial_archetype).toBeNull();
    expect(ouv.commercial_archetype).not.toEqual({});
    expect(ouv.commercial_archetype as unknown).not.toBe('');
  });

  it('TS-OUV-05: un monto grande no pierde precisión ni usa notación científica', () => {
    const ouv = presentOpportunity(opportunityDouble());

    expect(ouv.commercial_value?.amount).toBe(125000000);
    expect(JSON.stringify(ouv)).toContain('"amount":125000000');
    expect(JSON.stringify(ouv)).not.toContain('e+');
  });

  it('INV-10: el arquetipo expone referencia y nombre estables bajo autoridad CRM', () => {
    const ouv = presentOpportunity(opportunityDouble({ archetypeName: null }));

    expect(ouv.commercial_archetype).toEqual({
      ref: 'arch_b2g_structured',
      name: null,
    });
  });
});
