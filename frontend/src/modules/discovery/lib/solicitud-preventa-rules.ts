import type {
  SolicitudPreventa,
  SolicitudServicio,
} from '../api/solicitudes-preventa-api';
import {
  SERVICE_COMBOS,
  type ServiceComboId,
} from './opportunity-context-fields';

const DUPLICATE_COMBO_MESSAGE =
  'No es posible crear esta solicitud. Ya existe una solicitud en curso que cubre este tipo de actividad.';

export type MepSolicitudStatus =
  | 'Aceptado'
  | 'En progreso'
  | 'Parcialmente completo'
  | 'Completado'
  | 'Cancelado'
  | 'Rechazado'
  | 'Pendiente';

/**
 * Badge comercial: el último hecho MEP manda.
 * Cierre → Completado; IN_PROGRESS / asignación / ruta → En progreso;
 * acuse REJECTED → Rechazado; recepción o acuse ACCEPTED → Aceptado.
 */
export function derivarMepStatus(
  solicitud: SolicitudPreventa,
): MepSolicitudStatus {
  const hito = solicitud.estado.hito;
  const responseStatus = solicitud.estado.response_status;

  if (responseStatus === 'PARTIALLY_COMPLETED') {
    return 'Parcialmente completo';
  }

  if (hito === 'INTERACTION_COMPLETED' || responseStatus === 'COMPLETED') {
    return 'Completado';
  }

  if (
    responseStatus === 'IN_PROGRESS' ||
    hito === 'ENGINEER_ASSIGNED' ||
    hito === 'ROUTE_CAPACITY_REGISTERED'
  ) {
    return 'En progreso';
  }

  const acuse =
    solicitud.pista_tecnica[0]?.processing_status ?? solicitud.polling_status;

  if (acuse === 'REJECTED' || acuse === 'QUARANTINED') {
    return 'Rechazado';
  }

  if (acuse || hito === 'INTERACTION_RECEIVED' || responseStatus === 'RECEIVED') {
    return 'Aceptado';
  }

  return 'Pendiente';
}

/** Badge por servicio: `service_results[].status`, no el `response_status` global. */
export function derivarEstadoServicio(
  resultado: SolicitudServicio | undefined,
): MepSolicitudStatus {
  if (!resultado) {
    return 'Pendiente';
  }

  switch (resultado.status) {
    case 'COMPLETED':
      return 'Completado';
    case 'IN_PROGRESS':
      return 'En progreso';
    case 'RECEIVED':
      return 'Aceptado';
    case 'CANCELLED':
      return 'Cancelado';
    default:
      return 'Pendiente';
  }
}

/** Pendiente, Aceptado o En progreso cubren servicios; Completada y Rechazada no. */
export function esSolicitudEnCurso(solicitud: SolicitudPreventa): boolean {
  const estado = derivarMepStatus(solicitud);
  return (
    estado === 'Pendiente' ||
    estado === 'Aceptado' ||
    estado === 'En progreso' ||
    estado === 'Parcialmente completo'
  );
}

export function serviciosCubiertos(
  services: { service: string }[],
): string[] {
  return [...new Set(services.map((item) => item.service))];
}

/**
 * Bloquea el combo si alguna solicitud en curso pide el mismo servicio
 * (Técnica cubre también las combinadas; Financiera, al revés).
 */
export function comboTieneSolicitudActiva(
  solicitudes: SolicitudPreventa[],
  comboId: ServiceComboId,
): boolean {
  const combo = SERVICE_COMBOS.find((item) => item.id === comboId);
  if (!combo) {
    return false;
  }

  const wanted = new Set(serviciosCubiertos(combo.services));
  return solicitudes.some((solicitud) => {
    if (!esSolicitudEnCurso(solicitud)) {
      return false;
    }
    return solicitud.requested_services.some((item) => wanted.has(item.service));
  });
}

export { DUPLICATE_COMBO_MESSAGE };
