import {
  BusinessMilestone,
  ProcessingStatus,
  ResponseStatus,
} from '../domain/enums';

export const DUPLICATE_ACTIVITY_TYPE_MESSAGE =
  'No es posible crear esta solicitud. Ya existe una solicitud en curso que cubre este tipo de actividad.';

export const DUPLICATE_ACTIVITY_TYPE_CODE = 'SOLICITUD_PREVENTA_TIPO_ACTIVO';

/** Servicios pedidos, sin importar el orden ni la dependencia. */
export function serviceNames(
  services: Array<{ service: string }>,
): string[] {
  return [...new Set(services.map((item) => item.service))].sort();
}

/** Dos combos se superponen si comparten Técnica y/o Financiera. */
export function servicesOverlap(
  left: Array<{ service: string }>,
  right: Array<{ service: string }>,
): boolean {
  const covered = new Set(serviceNames(left));
  return serviceNames(right).some((name) => covered.has(name));
}

type ComboStatusView = {
  estado: { hito: string | null; response_status?: string | null };
  pista_tecnica: Array<{ processing_status: string }>;
  polling_status: string | null;
};

/** Aprobada o Rechazada ya no cubren el tipo; el resto sigue en curso. */
export function isSolicitudEnCurso(view: ComboStatusView): boolean {
  if (
    view.estado.hito === BusinessMilestone.INTERACTION_COMPLETED ||
    view.estado.response_status === ResponseStatus.COMPLETED
  ) {
    return false;
  }

  const status = view.pista_tecnica[0]?.processing_status ?? view.polling_status;
  if (
    status === ProcessingStatus.REJECTED ||
    status === ProcessingStatus.QUARANTINED
  ) {
    return false;
  }

  return true;
}
