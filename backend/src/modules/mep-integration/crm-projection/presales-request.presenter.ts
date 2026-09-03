import {
  BusinessMilestone,
  CapacityStatus,
  ProcessingStatus,
  ResponseStatus,
  RouteStatus,
  ServiceDependency,
  ServiceHorizon,
  ServiceName,
  ServiceOutcome,
  ServiceResultStatus,
} from '../domain/enums';
import { toDateOnly, toRfc3339 } from '../domain/rfc3339';
import {
  CommercialInteraction,
  MepResponseVersion,
  ProcessingReceipt,
} from '../models';
import { SERVICE_LABELS } from './presales-vocabulary';

/**
 * Proyección de una solicitud de preventa para la UI comercial — §14 Fase 3.
 *
 * T-301: los campos de presentación se **derivan** de `service_results[]`, que
 * es la fuente de verdad (AC-18). El CRM no inventa un estado paralelo.
 * T-304 / INV-12 / INV-14: los acuses técnicos viajan en `pista_tecnica`,
 * separados de `narrativa`. Son hechos de transporte, no hitos comerciales, y
 * la UI no debe mezclarlos ni duplicar notas por ambos hechos.
 * INV-25: `semantic_fingerprint` no se proyecta: es dato técnico opaco, jamás
 * un campo comercial.
 */

export interface PresalesServiceView {
  service: ServiceName;
  label: string;
  status: ServiceResultStatus;
  outcome: ServiceOutcome | null;
  dependency: ServiceDependency;
  summary: string | null;
  reason_code: string | null;
  /** `true` cuando el servicio espera el resultado del que depende (C-4). */
  bloqueado_por_dependencia: boolean;
  entregables: {
    url: string;
    label: string | null;
    published_at: string | null;
  }[];
}

export interface PresalesNarrativeEntry {
  response_version: number;
  business_milestone: BusinessMilestone;
  response_status: ResponseStatus;
  narrative_note: string | null;
  responded_at: string | null;
  responded_by: { ref: string; display_name: string };
}

export interface PresalesReceiptView {
  receipt_id: string;
  receipt_version: number;
  processing_status: ProcessingStatus;
  reason_code: string | null;
  observed_at: string | null;
}

export interface PresalesRequestView {
  crm_interaction_ref: string;
  crm_opportunity_ref: string | null;
  subject: string | null;
  service_horizon: ServiceHorizon;
  requested_services: {
    service: ServiceName;
    label: string;
    dependency: ServiceDependency;
  }[];
  /** Nota original del usuario comercial; siempre visible en la UI (T-302). */
  source_content: string;
  /** Documento SharePoint adjunto por el comercial. Solo UI CRM. */
  sharepoint_document_url: string | null;
  source_created_at: string | null;
  source_version: string;
  etag: string;

  /** Estado comercial derivado del último hito publicado por MEP. */
  estado: {
    hito: BusinessMilestone | null;
    response_status: ResponseStatus | null;
    eta_date: string | null;
    next_milestone: string | null;
    /** `true` mientras MEP no haya publicado ninguna respuesta. */
    sin_respuesta_mep: boolean;
  };

  asignacion: {
    engineer: { ref: string; display_name: string };
    assigned_at: string | null;
  } | null;

  /** Reloj propio V1/Vx; nunca se confunde con `response_version` (INV-17). */
  ruta_capacidad: {
    version: string;
    route_status: RouteStatus | null;
    capacity_status: CapacityStatus | null;
    summary: string | null;
    registered_at: string | null;
    /** Registro de SharePoint List. NO es un entregable (INV-23, AC-29). */
    registro_url: string | null;
  } | null;

  servicios: PresalesServiceView[];

  /** Enlace a la tarea Planner. Una interacción = una sola tarea (P-11). */
  planner_url: string | null;

  /** Clasificación entregada; `null` hasta el cierre (INV-20). */
  clasificacion_entregada: string | null;

  /** Narrativa MEP de más reciente a más antigua (T-302, TS-VER-08). */
  narrativa: PresalesNarrativeEntry[];

  /** Acuses técnicos, en pista separada de la narrativa (INV-12, INV-14). */
  pista_tecnica: PresalesReceiptView[];
}

export function presentPresalesRequest(
  interaction: CommercialInteraction,
  versions: MepResponseVersion[],
  receipts: ProcessingReceipt[],
): PresalesRequestView {
  // Más reciente primero: es el orden con el que la UI muestra la narrativa.
  const ordered = [...versions].sort(
    (a, b) => Number(b.responseVersion) - Number(a.responseVersion),
  );
  const latest = ordered[0] ?? null;

  const requested = [...(interaction.requestedServices ?? [])].sort(
    (a, b) => a.position - b.position,
  );

  const results = latest
    ? [...(latest.serviceResults ?? [])].sort((a, b) => a.position - b.position)
    : [];

  return {
    crm_interaction_ref: interaction.crmInteractionRef,
    crm_opportunity_ref: interaction.crmOpportunityRef ?? null,
    subject: interaction.subject ?? null,
    service_horizon: interaction.serviceHorizon,
    requested_services: requested.map((service) => ({
      service: service.service,
      label: SERVICE_LABELS[service.service] ?? service.service,
      dependency: service.dependency,
    })),
    source_content: interaction.sourceContent,
    sharepoint_document_url: interaction.sharepointDocumentUrl ?? null,
    source_created_at: toRfc3339(interaction.sourceCreatedAt),
    source_version: interaction.sourceVersion,
    etag: interaction.etag,

    estado: {
      hito: latest?.businessMilestone ?? null,
      response_status: latest?.responseStatus ?? null,
      eta_date: latest ? toDateOnly(latest.etaDate) : null,
      next_milestone: latest?.nextMilestone ?? null,
      sin_respuesta_mep: latest === null,
    },

    asignacion:
      latest && latest.assignmentEngineerRef
        ? {
            engineer: {
              ref: latest.assignmentEngineerRef,
              display_name: latest.assignmentEngineerName ?? '',
            },
            assigned_at: toRfc3339(latest.assignmentAssignedAt),
          }
        : null,

    ruta_capacidad:
      latest && latest.rcVersion
        ? {
            version: latest.rcVersion,
            route_status: latest.rcRouteStatus ?? null,
            capacity_status: latest.rcCapacityStatus ?? null,
            summary: latest.rcSummary ?? null,
            registered_at: toRfc3339(latest.rcRegisteredAt),
            registro_url: latest.routeCapacityRegisterUrl ?? null,
          }
        : null,

    servicios: results.map((result) => ({
      service: result.service,
      label: SERVICE_LABELS[result.service] ?? result.service,
      status: result.status,
      outcome: result.outcome ?? null,
      dependency: result.dependency,
      summary: result.summary ?? null,
      reason_code: result.reasonCode ?? null,
      // C-4: el financiero espera al técnico mientras este no haya cerrado.
      bloqueado_por_dependencia: isBlockedByDependency(result, results),
      entregables: [...(result.deliverables ?? [])].map((deliverable) => ({
        url: deliverable.url,
        label: deliverable.label ?? null,
        published_at: toRfc3339(deliverable.publishedAt),
      })),
    })),

    planner_url: latest?.plannerInteractionUrl ?? null,
    clasificacion_entregada: latest?.deliveredInteractionType ?? null,

    narrativa: ordered.map((version) => ({
      response_version: Number(version.responseVersion),
      business_milestone: version.businessMilestone,
      response_status: version.responseStatus,
      // P-08: solo el texto de esa versión, nunca la historia acumulada.
      narrative_note: version.narrativeNote ?? null,
      responded_at: toRfc3339(version.respondedAt),
      responded_by: {
        ref: version.respondedByRef,
        display_name: version.respondedByName,
      },
    })),

    pista_tecnica: [...receipts]
      .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime())
      .map((receipt) => ({
        receipt_id: receipt.receiptId,
        receipt_version: Number(receipt.receiptVersion),
        processing_status: receipt.processingStatus,
        reason_code: receipt.reasonCode ?? null,
        observed_at: toRfc3339(receipt.observedAt),
      })),
  };
}

/**
 * `ServiceDependency` nombra un servicio, así que comparte espacio de valores
 * con `ServiceName` (§3.1) — pero son enums distintos. La traducción se hace
 * aquí, explícita y exhaustiva, en vez de comparar los dos enums entre sí.
 */
function dependencyAsService(
  dependency: ServiceDependency,
): ServiceName | null {
  switch (dependency) {
    case ServiceDependency.TECHNICAL_DESIGN:
      return ServiceName.TECHNICAL_DESIGN;
    case ServiceDependency.FINANCIAL_DESIGN:
      return ServiceName.FINANCIAL_DESIGN;
    case ServiceDependency.NONE:
      return null;
  }
}

/**
 * Un servicio está bloqueado cuando depende de otro que aún no cerró.
 * Es derivación de presentación (T-301), no un estado persistido.
 */
function isBlockedByDependency(
  result: { dependency: ServiceDependency },
  all: { service: ServiceName; status: ServiceResultStatus }[],
): boolean {
  const dependsOn = dependencyAsService(result.dependency);
  if (dependsOn === null) {
    return false;
  }

  const blocker = all.find((item) => item.service === dependsOn);
  if (!blocker) {
    return false;
  }

  return blocker.status !== ServiceResultStatus.COMPLETED;
}
