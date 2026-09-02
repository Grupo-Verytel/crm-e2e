import { toDateOnly, toRfc3339 } from '../domain/rfc3339';
import {
  CommercialInteraction,
  CommercialOpportunity,
  MepResponseVersion,
  ProcessingReceipt,
} from '../models';

/**
 * Presentadores del contrato — §4, §6.3, §6.4, §6.5.
 *
 * Estas funciones son la **única** frontera de serialización de la
 * integración. Reglas que materializan:
 *
 *  - INV-06 / INV-19: ningún objeto expone `interaction_type` ni campo alguno
 *    derivado de la clasificación Planner.
 *  - INV-07: `source_content` sale byte a byte, sin trim ni normalización.
 *  - INV-09: los nulos se preservan; ninguna clave se omite ni se sustituye
 *    por `""`, `0` o un placeholder.
 *  - INV-15: la representación del `PUT` y la del `GET` se construyen aquí
 *    mismo, con lo persistido, de modo que son idénticas.
 *  - INV-25: `semantic_fingerprint` se devuelve solo en la representación
 *    técnica del acuse/respuesta, nunca como campo comercial derivado.
 */

export interface InteractionContract {
  crm_interaction_ref: string;
  crm_opportunity_ref: string | null;
  service_horizon: string;
  requested_services: { service: string; dependency: string }[];
  subject: string | null;
  source_content: string;
  source_created_at: string | null;
  source_version: string;
  etag: string;
}

export function presentInteraction(
  interaction: CommercialInteraction,
): InteractionContract {
  const services = [...(interaction.requestedServices ?? [])].sort(
    (a, b) => a.position - b.position,
  );

  return {
    crm_interaction_ref: interaction.crmInteractionRef,
    crm_opportunity_ref: interaction.crmOpportunityRef ?? null,
    service_horizon: interaction.serviceHorizon,
    requested_services: services.map((service) => ({
      service: service.service,
      dependency: service.dependency,
    })),
    subject: interaction.subject ?? null,
    // Sin trim, sin normalización, sin re-encoding (P-07).
    source_content: interaction.sourceContent,
    source_created_at: toRfc3339(interaction.sourceCreatedAt),
    source_version: interaction.sourceVersion,
    etag: interaction.etag,
  };
}

export interface OpportunityContract {
  crm_opportunity_ref: string;
  title: string | null;
  organization: { ref: string; name: string | null } | null;
  commercial_value: { amount: number; currency: string | null } | null;
  stage: { ref: string; name: string | null } | null;
  status: string | null;
  expected_close_date: string | null;
  commercial_owner: { ref: string; display_name: string | null } | null;
  commercial_archetype: { ref: string; name: string | null } | null;
  context_observed_at: string | null;
  source_version: string;
  etag: string;
}

export function presentOpportunity(
  opportunity: CommercialOpportunity,
  observedAt: Date = new Date(),
): OpportunityContract {
  return {
    crm_opportunity_ref: opportunity.crmOpportunityRef,
    title: opportunity.title ?? null,
    organization:
      opportunity.organizationRef === null
        ? null
        : {
            ref: opportunity.organizationRef,
            name: opportunity.organizationName ?? null,
          },
    commercial_value:
      opportunity.commercialAmount === null
        ? null
        : {
            // Entero en la unidad menor no fraccionada (COP sin decimales);
            // BIGINT llega como string desde MySQL, se emite como número sin
            // notación científica ni pérdida de precisión (TS-OUV-05).
            amount: Number(opportunity.commercialAmount),
            currency: opportunity.commercialCurrency ?? null,
          },
    stage:
      opportunity.stageRef === null
        ? null
        : { ref: opportunity.stageRef, name: opportunity.stageName ?? null },
    status: opportunity.status ?? null,
    expected_close_date: toDateOnly(opportunity.expectedCloseDate),
    commercial_owner:
      opportunity.commercialOwnerRef === null
        ? null
        : {
            ref: opportunity.commercialOwnerRef,
            display_name: opportunity.commercialOwnerName ?? null,
          },
    // INV-10 / INV-11: referencia y nombre estables o `null`, autoridad CRM.
    commercial_archetype:
      opportunity.archetypeRef === null
        ? null
        : {
            ref: opportunity.archetypeRef,
            name: opportunity.archetypeName ?? null,
          },
    context_observed_at: toRfc3339(observedAt),
    source_version: opportunity.sourceVersion,
    etag: opportunity.etag,
  };
}

export interface ProcessingReceiptContract {
  receipt_id: string;
  receipt_version: number;
  processing_status: string;
  correlation_id: string;
  observed_at: string | null;
  adapter_version: string;
  reason_code: string | null;
  semantic_fingerprint: string;
}

export function presentProcessingReceipt(
  receipt: ProcessingReceipt,
): ProcessingReceiptContract {
  return {
    receipt_id: receipt.receiptId,
    receipt_version: Number(receipt.receiptVersion),
    processing_status: receipt.processingStatus,
    correlation_id: receipt.correlationId,
    observed_at: toRfc3339(receipt.observedAt),
    adapter_version: receipt.adapterVersion,
    reason_code: receipt.reasonCode ?? null,
    semantic_fingerprint: receipt.semanticFingerprint,
  };
}

export interface ResponseContract {
  response_id: string;
  response_version: number;
  business_milestone: string;
  response_status: string;
  eta_date: string | null;
  next_milestone: string | null;
  responded_at: string | null;
  responded_by: { ref: string; display_name: string };
  assignment: {
    engineer: { ref: string; display_name: string };
    assigned_at: string | null;
  } | null;
  route_capacity: {
    version: string;
    route_status: string | null;
    capacity_status: string | null;
    summary: string | null;
    registered_at: string | null;
    registered_by: { ref: string; display_name: string } | null;
  } | null;
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
  operational_links: Record<string, string>;
  narrative_note: string | null;
  delivered_interaction_type: string | null;
  semantic_fingerprint: string;
}

export function presentResponseVersion(
  version: MepResponseVersion,
  responseId: string,
): ResponseContract {
  const results = [...(version.serviceResults ?? [])].sort(
    (a, b) => a.position - b.position,
  );

  // `operational_links` solo lleva las claves que existen: es un objeto de
  // enlaces opcionales por hito, no un registro de claves fijas nulables.
  const operationalLinks: Record<string, string> = {};
  if (version.plannerInteractionUrl) {
    operationalLinks.planner_interaction_url = version.plannerInteractionUrl;
  }
  if (version.routeCapacityRegisterUrl) {
    operationalLinks.route_capacity_register_url =
      version.routeCapacityRegisterUrl;
  }

  return {
    response_id: responseId,
    response_version: Number(version.responseVersion),
    business_milestone: version.businessMilestone,
    response_status: version.responseStatus,
    eta_date: toDateOnly(version.etaDate),
    next_milestone: version.nextMilestone ?? null,
    responded_at: toRfc3339(version.respondedAt),
    responded_by: {
      ref: version.respondedByRef,
      display_name: version.respondedByName,
    },
    assignment:
      version.assignmentEngineerRef === null
        ? null
        : {
            engineer: {
              ref: version.assignmentEngineerRef,
              display_name: version.assignmentEngineerName ?? '',
            },
            assigned_at: toRfc3339(version.assignmentAssignedAt),
          },
    // INV-17: `version` (V1/Vx) es un reloj propio; no se deriva de
    // `response_version` ni la arrastra.
    route_capacity:
      version.rcVersion === null
        ? null
        : {
            version: version.rcVersion,
            route_status: version.rcRouteStatus ?? null,
            capacity_status: version.rcCapacityStatus ?? null,
            summary: version.rcSummary ?? null,
            registered_at: toRfc3339(version.rcRegisteredAt),
            registered_by:
              version.rcRegisteredByRef === null
                ? null
                : {
                    ref: version.rcRegisteredByRef,
                    display_name: version.rcRegisteredByName ?? '',
                  },
          },
    service_results: results.map((result) => ({
      service: result.service,
      status: result.status,
      outcome: result.outcome ?? null,
      dependency: result.dependency,
      summary: result.summary ?? null,
      reason_code: result.reasonCode ?? null,
      deliverables: [...(result.deliverables ?? [])].map((deliverable) => ({
        url: deliverable.url,
        label: deliverable.label ?? null,
        published_at: toRfc3339(deliverable.publishedAt),
      })),
    })),
    operational_links: operationalLinks,
    // P-08: solo el texto de esta versión.
    narrative_note: version.narrativeNote ?? null,
    delivered_interaction_type: version.deliveredInteractionType ?? null,
    semantic_fingerprint: version.semanticFingerprint,
  };
}
