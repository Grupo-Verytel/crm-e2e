import type { SolicitudPreventa } from '../api/solicitudes-preventa-api';
import type { SolicitudPreventaRecord } from '../components/SolicitudPreventaModal';
import {
  buildServiceCards,
  SERVICE_COMBOS,
  type ActivityPriority,
  type ServiceCard,
  type ServiceCardState,
  type ServiceComboId,
} from './opportunity-context-fields';
import {
  derivarEstadoServicio,
  derivarMepStatus,
  type MepSolicitudStatus,
} from './solicitud-preventa-rules';
import { deliverableDisplayName } from './sharepoint-document';

export type DocumentoLink = {
  url: string;
  label: string;
};
const MILESTONE_LABEL: Record<string, string> = {
  INTERACTION_RECEIVED: 'Interacción recibida',
  ENGINEER_ASSIGNED: 'Ingeniero asignado',
  ROUTE_CAPACITY_REGISTERED: 'Ruta y capacidad registradas',
  INTERACTION_COMPLETED: 'Interacción completada',
};

function milestoneLabel(code: string): string {
  return MILESTONE_LABEL[code] ?? code;
}

export type PreventaHistoryDetail = {
  accion: string;
  resultado: string;
  origen: string;
  notas: string;
  registrado: string;
};

export type PreventaHistoryEntry = {
  version: string;
  actor: string;
  message: string;
  detail: PreventaHistoryDetail;
};

function horizonToPriority(horizon: string): ActivityPriority {
  return horizon === 'DEFERRED' ? 'SOMBRA' : 'ASAP';
}

function servicesSignature(
  services: { service: string; dependency: string }[],
): string {
  return services
    .map((s) => `${s.service}:${s.dependency}`)
    .sort()
    .join('|');
}

export function inferComboId(
  services: { service: string; dependency: string }[],
): ServiceComboId {
  const wanted = servicesSignature(services);
  const match = SERVICE_COMBOS.find(
    (combo) => servicesSignature(combo.services) === wanted,
  );
  return match?.id ?? 'technical';
}

function viabilidadFromApi(
  solicitud: SolicitudPreventa,
): SolicitudPreventaRecord['viabilidad'] {
  const codigos = solicitud.servicios
    .map((s) => s.viabilidad.codigo)
    .filter(Boolean);
  if (codigos.some((c) => c?.includes('NO_VIABLE'))) {
    return 'No viable';
  }
  if (codigos.some((c) => c?.includes('VIABLE'))) {
    return 'Viable';
  }
  return null;
}

export function serviceCardsFromSolicitud(
  solicitud: SolicitudPreventa,
): ServiceCard[] {
  const comboId = inferComboId(solicitud.requested_services);
  const base = buildServiceCards(comboId, {
    consecutivo: solicitud.crm_opportunity_ref ?? '',
    includeSharePoint: false,
  });

  return base.map((card) => {
    const resultado = solicitud.servicios.find((s) => s.service === card.service);
    const state: ServiceCardState = resultado?.bloqueado_por_dependencia
      ? 'blocked'
      : 'active';
    const deliverable = resultado?.entregables.find((d) => d.url?.trim());
    return {
      ...card,
      state,
      sharepointUrl: deliverable?.url ?? null,
      sharepointNombre: deliverable?.label ?? null,
    };
  });
}

export function mapSolicitudPreventaToRecord(
  solicitud: SolicitudPreventa,
): SolicitudPreventaRecord {
  const comboId = inferComboId(solicitud.requested_services);
  const combo = SERVICE_COMBOS.find((c) => c.id === comboId);
  const priority = horizonToPriority(solicitud.service_horizon);
  const mepStatus: MepSolicitudStatus = derivarMepStatus(solicitud);
  const createdAt =
    solicitud.source_created_at ?? new Date().toISOString();

  return {
    id: solicitud.crm_interaction_ref,
    priority,
    tipoId: comboId,
    tipoNombre: combo?.name ?? comboId,
    subject: solicitud.subject ?? '(Sin asunto)',
    status: 'ENVIADA',
    mepStatus,
    interactionRef: solicitud.crm_interaction_ref,
    sourceVersion: solicitud.source_version,
    etag: solicitud.estado.eta_date ?? solicitud.etag,
    services: serviceCardsFromSolicitud(solicitud),
    sameContainer: comboId === 'technical_and_financial',
    values: {
      crm_interaction_ref: solicitud.crm_interaction_ref,
      crm_opportunity_ref: solicitud.crm_opportunity_ref ?? '',
      activity_type: priority === 'SOMBRA' ? 'interaccion_sombra' : 'interaccion_asap',
      service_horizon: solicitud.service_horizon,
      subject: solicitud.subject ?? '',
      source_content: solicitud.source_content,
      source_created_at: solicitud.source_created_at ?? '',
      source_version: solicitud.source_version,
      etag: solicitud.estado.eta_date ?? '',
    },
    requestedServices: solicitud.requested_services.map((s) => ({
      service: s.service,
      dependency: s.dependency,
    })),
    createdAt,
    preventaAsignado:
      solicitud.asignacion?.engineer.display_name?.trim() || null,
    observaciones:
      solicitud.narrativa[0]?.narrative_note?.trim() ||
      solicitud.source_content,
    viabilidad: viabilidadFromApi(solicitud),
    tipoInteraccion: solicitud.clasificacion_entregada ?? '',
    fechaCierre: solicitud.estado.fecha_cierre,
    api: solicitud,
  };
}

export function buildHistoryFromSolicitud(
  solicitud: SolicitudPreventa,
): PreventaHistoryEntry[] {
  const narrativa = [...solicitud.narrativa].sort(
    (a, b) => b.response_version - a.response_version,
  );

  const fromNarrativa: PreventaHistoryEntry[] = narrativa.map((n) => ({
    version: `v${n.response_version}`,
    actor: n.responded_by.display_name || n.responded_by.ref,
    message:
      n.narrative_note?.trim() ||
      `${milestoneLabel(n.business_milestone)} · ${n.response_status}`,
    detail: {
      accion: milestoneLabel(n.business_milestone),
      resultado: n.response_status,
      origen: n.responded_by.display_name || n.responded_by.ref,
      notas: n.narrative_note?.trim() || '—',
      registrado: n.responded_at ?? '',
    },
  }));

  const fromReceipts: PreventaHistoryEntry[] = solicitud.pista_tecnica.map(
    (r) => ({
      version: `acuse-${r.receipt_version}`,
      actor: 'MEP-LEAN',
      message: `Acuse técnico · ${r.processing_status}`,
      detail: {
        accion: 'Acuse de recepción/procesamiento',
        resultado: r.processing_status,
        origen: r.receipt_id,
        notas: r.reason_code ?? 'Sin código de motivo.',
        registrado: r.observed_at ?? '',
      },
    }),
  );

  return [...fromNarrativa, ...fromReceipts].sort((a, b) => {
    const ta = new Date(a.detail.registrado).getTime();
    const tb = new Date(b.detail.registrado).getTime();
    if (Number.isNaN(ta) || Number.isNaN(tb)) {
      return 0;
    }
    return tb - ta;
  });
}

/** Entregables MEP del servicio + adjunto comercial de la solicitud (sin duplicar URL). */
export function collectDocumentosForService(
  solicitud: SolicitudPreventa,
  serviceName: string,
): DocumentoLink[] {
  const items: DocumentoLink[] = [];
  const seen = new Set<string>();

  function add(url: string | null | undefined, label: string | null | undefined) {
    const trimmed = url?.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    items.push({
      url: trimmed,
      label: deliverableDisplayName({ url: trimmed, label: label ?? null }),
    });
  }

  const resultado = solicitud.servicios.find((s) => s.service === serviceName);
  for (const entregable of resultado?.entregables ?? []) {
    add(entregable.url, entregable.label);
  }

  add(
    solicitud.sharepoint_document_url,
    'Documento comercial adjunto',
  );

  return items;
}

export { derivarEstadoServicio };
