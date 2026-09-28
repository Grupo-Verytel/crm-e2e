import {
  OuvResultado,
  OuvSegmento,
  OuvZona,
} from '../../discovery/models/enums/ouv.enums';
import {
  BusinessMilestone,
  ProcessingStatus,
  ResponseStatus,
  ServiceDependency,
  ServiceHorizon,
  ServiceName,
  ServiceResultStatus,
} from '../domain/enums';
import { MepProblemException } from '../domain/mep-problem.exception';
import { OuvContextService } from './ouv-context.service';

const REF = 'OUV-0001';

interface InteractionRow {
  id: string;
  crmInteractionRef: string;
  crmOpportunityRef: string;
  serviceHorizon: ServiceHorizon;
  subject: string | null;
  sharepointDocumentUrl: string | null;
  sourceContent: string;
  sourceCreatedAt: Date;
  sourceVersion: string;
  etag: string;
  eligibleForMep: boolean;
  pollingStatus: ProcessingStatus | null;
  requestedServices: {
    service: ServiceName;
    dependency: ServiceDependency;
    position: number;
  }[];
  update: jest.Mock;
  save: jest.Mock;
}

function interaction(
  partial: Partial<InteractionRow> &
    Pick<InteractionRow, 'id' | 'sourceCreatedAt'>,
): InteractionRow {
  return {
    crmInteractionRef: `int_${partial.id}`,
    crmOpportunityRef: REF,
    serviceHorizon: ServiceHorizon.IMMEDIATE,
    subject: `Asunto ${partial.id}`,
    sharepointDocumentUrl: null,
    sourceContent: `contenido ${partial.id}`,
    sourceVersion: '1',
    etag: `"int-${partial.id}-v1"`,
    eligibleForMep: true,
    pollingStatus: null,
    requestedServices: [],
    update: jest.fn(),
    save: jest.fn(),
    ...partial,
  };
}

async function expectProblem(
  run: () => Promise<unknown>,
  status: number,
  code: string,
) {
  try {
    await run();
    throw new Error('se esperaba un error del contrato');
  } catch (error) {
    expect(error).toBeInstanceOf(MepProblemException);
    const problem = error as MepProblemException;
    expect(problem.getStatus()).toBe(status);
    expect(problem.code).toBe(code);
  }
}

function allOf(opportunityRef: string, store: InteractionRow[]) {
  const rows = store.filter((row) => row.crmOpportunityRef === opportunityRef);
  rows.sort((a, b) => {
    const delta = b.sourceCreatedAt.getTime() - a.sourceCreatedAt.getTime();
    if (delta !== 0) return delta;
    return Number(BigInt(b.id) - BigInt(a.id));
  });
  return rows;
}

function ouvFixture() {
  return {
    consecutivo: REF,
    titulo: 'Enlace norte',
    accountId: 'acc_1',
    empresaNombre: 'Alcaldía',
    presupuestoMonto: '1000000',
    presupuestoMoneda: 'COP',
    zonaActual: OuvZona.Universo,
    segmento: OuvSegmento.GobiernoCentral,
    segmentId: 'seg_1',
    comercialId: 'user_1',
    resultado: OuvResultado.EnCurso,
    createdAt: new Date('2026-01-15T00:00:00.000Z'),
    plazoEjecucionMeses: 6,
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    comercial: { fullName: 'Carlos Ruiz' },
    update: jest.fn(),
    save: jest.fn(),
  };
}

describe('OuvContextService', () => {
  const persisted = {
    crmOpportunityRef: REF,
    title: 'Enlace norte',
    organizationRef: 'acc_1',
    organizationName: 'Alcaldía',
    commercialAmount: '1000000',
    commercialCurrency: 'COP',
    stageRef: OuvZona.Universo,
    stageName: OuvZona.Universo,
    status: OuvResultado.EnCurso,
    expectedCloseDate: '2026-07-15',
    commercialOwnerRef: 'user_1',
    commercialOwnerName: 'Carlos Ruiz',
    archetypeRef: 'seg_1',
    archetypeName: OuvSegmento.GobiernoCentral,
    sourceVersion: '4',
    etag: '"persisted-ouv-etag"',
    update: jest.fn(),
    save: jest.fn(),
  };

  function serviceFor(options: {
    ouv?: ReturnType<typeof ouvFixture> | null;
    stored?: typeof persisted | null;
    interactions?: InteractionRow[];
    responses?: { id: string; interactionId: string }[];
    versions?: Record<string, unknown>[];
    receipts?: Record<string, unknown>[];
  }) {
    const store = options.interactions ?? [];
    const queries: string[] = [];
    const ouvModel = {
      findOne: jest.fn(() =>
        options.ouv === undefined ? ouvFixture() : options.ouv,
      ),
      update: jest.fn(),
      create: jest.fn(),
    };
    const opportunityModel = {
      findOne: jest.fn(() =>
        options.stored === undefined ? persisted : options.stored,
      ),
      build: jest.fn((values: Record<string, unknown>) => ({ ...values })),
      update: jest.fn(),
      create: jest.fn(),
    };
    const interactionModel = {
      findAll: jest.fn((query: { where: { crmOpportunityRef: string } }) =>
        allOf(query.where.crmOpportunityRef, store),
      ),
      update: jest.fn(),
      create: jest.fn(),
    };
    const responseModel = {
      findAll: jest.fn(() => options.responses ?? []),
      update: jest.fn(),
      create: jest.fn(),
    };
    const versionModel = {
      findAll: jest.fn(() => options.versions ?? []),
      update: jest.fn(),
      create: jest.fn(),
    };
    const receiptModel = {
      findAll: jest.fn(() => options.receipts ?? []),
      update: jest.fn(),
      create: jest.fn(),
    };
    const sequelize = {
      query: jest.fn((sql: string) => {
        queries.push(sql);
        const newest = store.reduce<Date | null>((max, row) => {
          if (!max || row.sourceCreatedAt > max) return row.sourceCreatedAt;
          return max;
        }, null);
        return [
          {
            interaction_count: store.length,
            interaction_clock: newest,
            response_clock: options.versions?.length
              ? new Date('2026-09-02T00:00:00.000Z')
              : null,
            receipt_clock: options.receipts?.length
              ? new Date('2026-09-01T11:00:00.000Z')
              : null,
          },
        ];
      }),
    };

    const service = new OuvContextService(
      ouvModel as never,
      opportunityModel as never,
      interactionModel as never,
      responseModel as never,
      versionModel as never,
      receiptModel as never,
      sequelize as never,
    );

    return {
      service,
      ouvModel,
      opportunityModel,
      interactionModel,
      queries,
      persisted,
    };
  }

  function assertReadOnly(harness: ReturnType<typeof serviceFor>) {
    expect(harness.ouvModel.update).not.toHaveBeenCalled();
    expect(harness.ouvModel.create).not.toHaveBeenCalled();
    expect(harness.opportunityModel.update).not.toHaveBeenCalled();
    expect(harness.opportunityModel.create).not.toHaveBeenCalled();
    expect(harness.interactionModel.update).not.toHaveBeenCalled();
    expect(harness.interactionModel.create).not.toHaveBeenCalled();
    expect(harness.persisted.etag).toBe('"persisted-ouv-etag"');
    expect(harness.persisted.sourceVersion).toBe('4');
    for (const sql of harness.queries) {
      expect(sql.trim().startsWith('SELECT')).toBe(true);
      expect(/\bINSERT\b|\bUPDATE\b|\bDELETE\b/i.test(sql)).toBe(false);
    }
  }

  it('devuelve la OUV y el historial de la solicitud a MEP-LEAN', async () => {
    const row = interaction({
      id: '9',
      sourceCreatedAt: new Date('2026-09-01T10:00:00.000Z'),
      crmInteractionRef: 'int_ouv0001_1',
      subject: 'Diseño técnico',
      sourceContent: 'Necesitamos viabilidad.',
      sharepointDocumentUrl: 'https://contoso.sharepoint.com/sites/docs/a.docx',
      pollingStatus: ProcessingStatus.ACCEPTED,
      requestedServices: [
        {
          service: ServiceName.TECHNICAL_DESIGN,
          dependency: ServiceDependency.NONE,
          position: 0,
        },
      ],
    });
    const harness = serviceFor({
      interactions: [row],
      responses: [{ id: '3', interactionId: '9' }],
      versions: [
        {
          mepResponseId: '3',
          responseVersion: 2,
          businessMilestone: BusinessMilestone.ENGINEER_ASSIGNED,
          responseStatus: ResponseStatus.IN_PROGRESS,
          etaDate: '2026-09-20',
          nextMilestone: null,
          respondedAt: new Date('2026-09-01T12:00:00.000Z'),
          respondedByRef: 'mep_user',
          respondedByName: 'Preventa MEP',
          assignmentEngineerRef: 'eng_1',
          assignmentEngineerName: 'Ana Pérez',
          assignmentAssignedAt: new Date('2026-09-01T12:00:00.000Z'),
          rcVersion: null,
          narrativeNote: 'Ingeniero asignado.',
          semanticFingerprint: 'abc123fingerprint',
          payloadHash: 'deadbeef',
          plannerInteractionUrl: null,
          deliveredInteractionType: null,
          serviceResults: [
            {
              service: ServiceName.TECHNICAL_DESIGN,
              status: ServiceResultStatus.IN_PROGRESS,
              outcome: null,
              dependency: ServiceDependency.NONE,
              summary: 'En curso',
              reasonCode: null,
              position: 0,
              deliverables: [],
            },
          ],
        },
      ],
      receipts: [
        {
          interactionId: '9',
          receiptId: 'rcpt_1',
          receiptVersion: 1,
          processingStatus: ProcessingStatus.ACCEPTED,
          reasonCode: null,
          observedAt: new Date('2026-09-01T11:00:00.000Z'),
          semanticFingerprint: 'should-not-leak',
        },
      ],
    });

    const body = await harness.service.read(REF);
    const item = body.mep_interactions.items[0];

    expect(body.opportunity.crm_opportunity_ref).toBe(REF);
    expect(body.opportunity.source_version).toBe('4');
    expect(item.crm_interaction_ref).toBe('int_ouv0001_1');
    expect(item.source_content).toBe('Necesitamos viabilidad.');
    expect(item.narrativa[0]).toMatchObject({
      response_version: 2,
      narrative_note: 'Ingeniero asignado.',
      responded_by: { display_name: 'Preventa MEP' },
    });
    expect(item.pista_tecnica[0]).toMatchObject({
      receipt_id: 'rcpt_1',
      processing_status: 'ACCEPTED',
    });
    expect(item.estado.sin_respuesta_mep).toBe(false);

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('abc123fingerprint');
    expect(serialized).not.toContain('deadbeef');
    expect(serialized).not.toContain('should-not-leak');
    expect(serialized).not.toContain('semantic_fingerprint');
    expect(body.etag).toBe(body.etag);
    assertReadOnly(harness);
  });

  it('una OUV sin solicitudes devuelve mep_interactions vacío', async () => {
    const harness = serviceFor({ stored: null, interactions: [] });

    const body = await harness.service.read(REF);

    expect(body.opportunity.crm_opportunity_ref).toBe(REF);
    expect(body.opportunity.source_version).toBe('0');
    expect(body.mep_interactions).toEqual({ items: [] });
    expect(body.mep_interactions).not.toHaveProperty('next_cursor');
    expect(harness.opportunityModel.create).not.toHaveBeenCalled();
    expect(harness.opportunityModel.update).not.toHaveBeenCalled();
  });

  it('una OUV inexistente responde 404 sin leer interacciones', async () => {
    const harness = serviceFor({ ouv: null });

    await expectProblem(
      () => harness.service.read('OUV-9999'),
      404,
      'NOT_FOUND',
    );
    expect(harness.interactionModel.findAll).not.toHaveBeenCalled();
    expect(harness.opportunityModel.create).not.toHaveBeenCalled();
  });

  it('devuelve las 25 solicitudes en una sola respuesta, de la más reciente a la más antigua', async () => {
    const interactions = Array.from({ length: 25 }, (_, index) => {
      const id = String(index + 1);
      return interaction({
        id,
        sourceCreatedAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
      });
    });
    const harness = serviceFor({ interactions });

    const body = await harness.service.read(REF);
    const seen = body.mep_interactions.items.map(
      (item) => item.crm_interaction_ref,
    );

    expect(seen).toHaveLength(25);
    expect(new Set(seen).size).toBe(25);
    expect(seen[0]).toBe('int_25');
    expect(seen[24]).toBe('int_1');
    expect(body.mep_interactions).not.toHaveProperty('next_cursor');
    assertReadOnly(harness);
  });

  it('con el mismo source_created_at ordena por id descendente', async () => {
    const stamp = new Date('2026-09-01T10:00:00.000Z');
    const interactions = ['1', '2', '3'].map((id) =>
      interaction({
        id,
        sourceCreatedAt: stamp,
        crmInteractionRef: `int_${id}`,
      }),
    );
    const harness = serviceFor({ interactions });

    const body = await harness.service.read(REF);
    const seen = body.mep_interactions.items.map(
      (item) => item.crm_interaction_ref,
    );

    expect(seen).toEqual(['int_3', 'int_2', 'int_1']);
  });

  it('la misma lectura produce el mismo ETag y no escribe', async () => {
    const harness = serviceFor({
      interactions: [
        interaction({
          id: '1',
          sourceCreatedAt: new Date('2026-09-01T10:00:00.000Z'),
        }),
      ],
    });

    const first = await harness.service.read(REF);
    const second = await harness.service.read(REF);

    expect(second.etag).toBe(first.etag);
    expect(second.opportunity.etag).toBe(first.opportunity.etag);
    expect(second.opportunity.source_version).toBe('4');
    assertReadOnly(harness);
  });
});
