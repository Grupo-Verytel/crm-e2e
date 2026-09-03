import { readFileSync } from 'fs';
import { join } from 'path';
import {
  BusinessMilestone,
  ResponseStatus,
  ServiceDependency,
  ServiceHorizon,
  ServiceName,
  ServiceResultStatus,
} from '../domain/enums';
import {
  CommercialInteraction,
  MepResponseVersion,
  ProcessingReceipt,
} from '../models';
import { presentPresalesRequest } from './presales-request.presenter';

const FIXTURES = join(__dirname, '../../../../test/fixtures/responses');

const SOURCE_CONTENT =
  'El modelo financiero inicia después del resultado técnico.';

function interactionDouble(): CommercialInteraction {
  return {
    crmInteractionRef: 'int_20004',
    crmOpportunityRef: 'ouv_9104',
    subject: 'Diseño técnico seguido de financiero',
    serviceHorizon: ServiceHorizon.IMMEDIATE,
    sourceContent: SOURCE_CONTENT,
    sourceCreatedAt: new Date('2026-08-21T14:36:00Z'),
    sourceVersion: '1',
    etag: '"int-20004-v1"',
    requestedServices: [
      {
        service: ServiceName.FINANCIAL_DESIGN,
        dependency: ServiceDependency.TECHNICAL_DESIGN,
        position: 1,
      },
      {
        service: ServiceName.TECHNICAL_DESIGN,
        dependency: ServiceDependency.NONE,
        position: 0,
      },
    ],
  } as unknown as CommercialInteraction;
}

/** Construye una versión persistida a partir del fixture del contrato. */
function versionDouble(v: 1 | 2 | 3 | 4 | 5): MepResponseVersion {
  const f = JSON.parse(
    readFileSync(join(FIXTURES, `response-v${v}.json`), 'utf8'),
  ) as Record<string, never> & {
    response_version: number;
    business_milestone: string;
    response_status: string;
    eta_date: string | null;
    next_milestone: string | null;
    narrative_note: string | null;
    delivered_interaction_type: string | null;
    responded_at: string;
    responded_by: { ref: string; display_name: string };
    assignment: {
      engineer: { ref: string; display_name: string };
      assigned_at: string;
    } | null;
    route_capacity: Record<string, string> | null;
    operational_links: Record<string, string>;
    service_results: {
      service: string;
      status: string;
      outcome: string | null;
      dependency: string;
      summary: string | null;
      reason_code: string | null;
      deliverables: {
        url: string;
        label: string | null;
        published_at: string | null;
      }[];
    }[];
  };

  return {
    responseVersion: f.response_version,
    businessMilestone: f.business_milestone,
    responseStatus: f.response_status,
    etaDate: f.eta_date,
    nextMilestone: f.next_milestone,
    narrativeNote: f.narrative_note,
    deliveredInteractionType: f.delivered_interaction_type,
    respondedAt: new Date(f.responded_at),
    respondedByRef: f.responded_by.ref,
    respondedByName: f.responded_by.display_name,
    assignmentEngineerRef: f.assignment?.engineer.ref ?? null,
    assignmentEngineerName: f.assignment?.engineer.display_name ?? null,
    assignmentAssignedAt: f.assignment
      ? new Date(f.assignment.assigned_at)
      : null,
    rcVersion: f.route_capacity?.version ?? null,
    rcRouteStatus: f.route_capacity?.route_status ?? null,
    rcCapacityStatus: f.route_capacity?.capacity_status ?? null,
    rcSummary: f.route_capacity?.summary ?? null,
    rcRegisteredAt: f.route_capacity
      ? new Date(f.route_capacity.registered_at)
      : null,
    plannerInteractionUrl: f.operational_links.planner_interaction_url ?? null,
    routeCapacityRegisterUrl:
      f.operational_links.route_capacity_register_url ?? null,
    semanticFingerprint: 'f'.repeat(64),
    serviceResults: f.service_results.map((r, position) => ({
      service: r.service,
      status: r.status,
      outcome: r.outcome,
      dependency: r.dependency,
      summary: r.summary,
      reasonCode: r.reason_code,
      position,
      deliverables: r.deliverables.map((d) => ({
        url: d.url,
        label: d.label,
        publishedAt: d.published_at ? new Date(d.published_at) : null,
      })),
    })),
  } as unknown as MepResponseVersion;
}

function receiptDouble(): ProcessingReceipt {
  return {
    receiptId: 'mep:receipt:int_20004:v1',
    receiptVersion: 1,
    processingStatus: 'ACCEPTED',
    reasonCode: null,
    observedAt: new Date('2026-08-21T14:37:12Z'),
  } as unknown as ProcessingReceipt;
}

describe('proyección de solicitud de preventa — §14 Fase 3', () => {
  it('sin respuesta de MEP, el estado lo dice explícitamente', () => {
    const view = presentPresalesRequest(interactionDouble(), [], []);

    expect(view.estado.sin_respuesta_mep).toBe(true);
    expect(view.estado.hito).toBeNull();
    expect(view.narrativa).toEqual([]);
    expect(view.pista_tecnica).toEqual([]);
    expect(view.servicios).toEqual([]);
  });

  it('T-302 / TS-VER-08: la narrativa va de más reciente a más antigua', () => {
    const view = presentPresalesRequest(
      interactionDouble(),
      [versionDouble(1), versionDouble(3), versionDouble(5)],
      [],
    );

    expect(view.narrativa.map((n) => n.response_version)).toEqual([5, 3, 1]);
  });

  it('T-302: el contenido original queda siempre visible junto a la narrativa', () => {
    const view = presentPresalesRequest(
      interactionDouble(),
      [versionDouble(5)],
      [],
    );

    expect(view.source_content).toBe(SOURCE_CONTENT);
    expect(view.sharepoint_document_url).toBeNull();
  });

  it('P-08: cada entrada narrativa trae solo el texto de su versión', () => {
    const view = presentPresalesRequest(
      interactionDouble(),
      [versionDouble(1), versionDouble(3)],
      [],
    );

    const v3 = view.narrativa.find((n) => n.response_version === 3);
    const v1 = view.narrativa.find((n) => n.response_version === 1);

    expect(v3?.narrative_note).not.toContain(v1?.narrative_note ?? '');
  });

  it('T-304 / INV-12: los acuses van en pista técnica, fuera de la narrativa', () => {
    const view = presentPresalesRequest(
      interactionDouble(),
      [versionDouble(1)],
      [receiptDouble()],
    );

    expect(view.pista_tecnica).toHaveLength(1);
    expect(view.pista_tecnica[0].processing_status).toBe('ACCEPTED');
    // El acuse no aparece como hito ni como entrada narrativa.
    expect(view.narrativa).toHaveLength(1);
    expect(JSON.stringify(view.narrativa)).not.toContain('ACCEPTED');
  });

  it('T-301 / AC-18: los servicios se derivan del último service_results[]', () => {
    const view = presentPresalesRequest(
      interactionDouble(),
      [versionDouble(1), versionDouble(5)],
      [],
    );

    expect(view.servicios.map((s) => s.status)).toEqual([
      ServiceResultStatus.COMPLETED,
      ServiceResultStatus.COMPLETED,
    ]);
    expect(view.estado.hito).toBe(BusinessMilestone.INTERACTION_COMPLETED);
    expect(view.estado.response_status).toBe(ResponseStatus.COMPLETED);
  });

  it('C-4: el financiero aparece bloqueado mientras el técnico no cierre', () => {
    const view = presentPresalesRequest(
      interactionDouble(),
      [versionDouble(3)],
      [],
    );

    const tecnico = view.servicios.find(
      (s) => s.service === ServiceName.TECHNICAL_DESIGN,
    );
    const financiero = view.servicios.find(
      (s) => s.service === ServiceName.FINANCIAL_DESIGN,
    );

    expect(tecnico?.bloqueado_por_dependencia).toBe(false);
    expect(financiero?.bloqueado_por_dependencia).toBe(true);
  });

  it('C-4: al cerrar el técnico, el financiero deja de estar bloqueado', () => {
    const view = presentPresalesRequest(
      interactionDouble(),
      [versionDouble(5)],
      [],
    );

    expect(
      view.servicios.every((s) => s.bloqueado_por_dependencia === false),
    ).toBe(true);
  });

  it('INV-17: ruta/capacidad expone su propio reloj, no la response_version', () => {
    const view = presentPresalesRequest(
      interactionDouble(),
      [versionDouble(5)],
      [],
    );

    expect(view.ruta_capacidad?.version).toBe('V2');
    expect(view.narrativa[0].response_version).toBe(5);
  });

  it('AC-29 / INV-23: el registro SharePoint List no aparece como entregable', () => {
    const view = presentPresalesRequest(
      interactionDouble(),
      [versionDouble(5)],
      [],
    );

    expect(view.ruta_capacidad?.registro_url).toContain('/Lists/');

    const entregables = view.servicios.flatMap((s) => s.entregables);
    expect(entregables).toHaveLength(2);
    expect(entregables.every((d) => !d.url.includes('/Lists/'))).toBe(true);
    expect(entregables.every((d) => d.url.includes('Shared%20Documents'))).toBe(
      true,
    );
  });

  it('P-11: `planner_url` es escalar — una interacción, una sola tarea', () => {
    const view = presentPresalesRequest(
      interactionDouble(),
      [versionDouble(5)],
      [],
    );

    expect(typeof view.planner_url).toBe('string');
    expect(Array.isArray(view.planner_url)).toBe(false);
  });

  it('INV-20: la clasificación solo aparece cuando la interacción cerró', () => {
    const abierta = presentPresalesRequest(
      interactionDouble(),
      [versionDouble(3)],
      [],
    );
    const cerrada = presentPresalesRequest(
      interactionDouble(),
      [versionDouble(5)],
      [],
    );

    expect(abierta.clasificacion_entregada).toBeNull();
    expect(cerrada.clasificacion_entregada).toBe('DISENO_TECNICO_Y_FINANCIERO');
  });

  it('INV-25: la vista comercial no expone `semantic_fingerprint`', () => {
    const view = presentPresalesRequest(
      interactionDouble(),
      [versionDouble(5)],
      [receiptDouble()],
    );

    expect(JSON.stringify(view)).not.toContain('semantic_fingerprint');
    expect(JSON.stringify(view)).not.toContain('f'.repeat(64));
  });

  it('INV-06: la vista comercial no expone `interaction_type`', () => {
    const view = presentPresalesRequest(
      interactionDouble(),
      [versionDouble(5)],
      [],
    );

    expect(JSON.stringify(view)).not.toContain('"interaction_type"');
  });

  it('§4: los servicios solicitados respetan el orden de `position`', () => {
    const view = presentPresalesRequest(interactionDouble(), [], []);

    expect(view.requested_services.map((s) => s.service)).toEqual([
      ServiceName.TECHNICAL_DESIGN,
      ServiceName.FINANCIAL_DESIGN,
    ]);
    expect(view.requested_services[0].label).toBe('Técnica');
    expect(view.requested_services[1].label).toBe('Financiera');
  });
});
