import { apiRequest } from '../../../lib/api/http-client';
import type {
  ActivityPriority,
  BusinessMilestone,
  CapacityStatus,
  ProcessingStatus,
  RouteStatus,
  ServiceCombo,
  ServiceHorizon,
  ServiceName,
  ServiceOutcome,
  ServiceResultStatus,
} from '../lib/preventa-vocab';

/**
 * Solicitudes de preventa de una OUV — Fase 3 de SPEC-CRM-MEPLEAN-001.
 *
 * Habla con la superficie del CRM (`api/v1`, JWT), no con el contrato `/v1` de
 * MEP-LEAN: ese es servidor-a-servidor, se autentica con una API key de
 * service account y no admite CORS (§5.1, §10.1, §10.3). Desde el navegador
 * jamás se le pega directo.
 */

export type SolicitudEntregable = {
  url: string;
  label: string | null;
  published_at: string | null;
};

export type SolicitudServicio = {
  service: ServiceName;
  label: string;
  status: ServiceResultStatus;
  outcome: ServiceOutcome | null;
  dependency: string;
  summary: string | null;
  reason_code: string | null;
  /** El servicio espera el resultado de aquel del que depende (caso C-4). */
  bloqueado_por_dependencia: boolean;
  entregables: SolicitudEntregable[];
};

export type SolicitudNarrativa = {
  response_version: number;
  business_milestone: BusinessMilestone;
  response_status: string;
  /** Solo el texto de esa versión, nunca la historia acumulada (P-08). */
  narrative_note: string | null;
  responded_at: string | null;
  responded_by: { ref: string; display_name: string };
};

/** Acuse técnico: hecho de transporte, no hito comercial (INV-12). */
export type SolicitudAcuse = {
  receipt_id: string;
  receipt_version: number;
  processing_status: ProcessingStatus;
  reason_code: string | null;
  observed_at: string | null;
};

export type SolicitudPreventa = {
  crm_interaction_ref: string;
  crm_opportunity_ref: string | null;
  subject: string | null;
  service_horizon: ServiceHorizon;
  requested_services: {
    service: ServiceName;
    label: string;
    dependency: string;
  }[];
  /** Nota original del comercial; se muestra siempre (T-302). */
  source_content: string;
  /** Documento SharePoint adjunto por el comercial. Solo UI CRM. */
  sharepoint_document_url: string | null;
  source_created_at: string | null;
  source_version: string;
  etag: string;

  estado: {
    hito: BusinessMilestone | null;
    response_status: string | null;
    eta_date: string | null;
    next_milestone: string | null;
    sin_respuesta_mep: boolean;
  };

  asignacion: {
    engineer: { ref: string; display_name: string };
    assigned_at: string | null;
  } | null;

  ruta_capacidad: {
    version: string;
    route_status: RouteStatus | null;
    capacity_status: CapacityStatus | null;
    summary: string | null;
    registered_at: string | null;
    /** Registro de SharePoint List; nunca es un entregable (INV-23). */
    registro_url: string | null;
  } | null;

  servicios: SolicitudServicio[];
  planner_url: string | null;
  clasificacion_entregada: string | null;
  narrativa: SolicitudNarrativa[];
  pista_tecnica: SolicitudAcuse[];
  /** Último processing_status del acuse MEP. `null` si aún no hay receipt. */
  polling_status: ProcessingStatus | null;
};

/**
 * Solo decisiones de negocio. La referencia de interacción, la versión de
 * origen y el ETag son autoridad del CRM y los emite el backend (§4, P-01).
 */
export type CrearSolicitudPreventaPayload = {
  priority: ActivityPriority;
  service_combo: ServiceCombo;
  subject?: string;
  source_content: string;
  sharepoint_document_url?: string;
};

export function fetchSolicitudesPreventa(
  ouvId: string,
): Promise<SolicitudPreventa[]> {
  return apiRequest<SolicitudPreventa[]>(
    `/discovery/ouvs/${ouvId}/solicitudes-preventa`,
  );
}

export function fetchSolicitudPreventa(
  ouvId: string,
  interactionRef: string,
): Promise<SolicitudPreventa> {
  return apiRequest<SolicitudPreventa>(
    `/discovery/ouvs/${ouvId}/solicitudes-preventa/${encodeURIComponent(interactionRef)}`,
  );
}

export function crearSolicitudPreventa(
  ouvId: string,
  payload: CrearSolicitudPreventaPayload,
): Promise<SolicitudPreventa> {
  return apiRequest<SolicitudPreventa>(
    `/discovery/ouvs/${ouvId}/solicitudes-preventa`,
    { method: 'POST', body: payload },
  );
}
