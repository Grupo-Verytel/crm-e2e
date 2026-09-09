import type { SolicitudPreventa } from '../api/solicitudes-preventa-api';
import {
  SERVICE_COMBOS,
  type ServiceComboId,
} from './opportunity-context-fields';

const DUPLICATE_COMBO_MESSAGE =
  'No es posible crear esta solicitud. Ya existe una solicitud en curso que cubre este tipo de actividad.';

export type MepSolicitudStatus =
  | 'Aceptado'
  | 'En progreso'
  | 'Aprobado'
  | 'Rechazado'
  | 'Pendiente';

/**
 * Badge comercial: el último hecho MEP manda.
 * Cierre → Aprobado; IN_PROGRESS / asignación / ruta → En progreso;
 * acuse REJECTED → Rechazado; recepción o acuse ACCEPTED → Aceptado.
 */
export function derivarMepStatus(
  solicitud: SolicitudPreventa,
): MepSolicitudStatus {
  const hito = solicitud.estado.hito;
  const responseStatus = solicitud.estado.response_status;

  if (hito === 'INTERACTION_COMPLETED' || responseStatus === 'COMPLETED') {
    return 'Aprobado';
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

/** Pendiente, Aceptado o En progreso cubren servicios; Aprobada y Rechazada no. */
export function esSolicitudEnCurso(solicitud: SolicitudPreventa): boolean {
  const estado = derivarMepStatus(solicitud);
  return (
    estado === 'Pendiente' ||
    estado === 'Aceptado' ||
    estado === 'En progreso'
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
