import type { SolicitudPreventa } from '../api/solicitudes-preventa-api';
import {
  SERVICE_COMBOS,
  type ServiceComboId,
} from './opportunity-context-fields';

const DUPLICATE_COMBO_MESSAGE =
  'No es posible crear una nueva solicitud para este tipo de actividad. Ya existe una solicitud activa o aprobada.';

export type MepSolicitudStatus =
  | 'Aceptado'
  | 'Aprobado'
  | 'Rechazado'
  | 'Pendiente';

export function comboFingerprint(
  services: { service: string; dependency: string }[],
): string {
  return [...services]
    .map((item) => `${item.service}:${item.dependency}`)
    .sort()
    .join('|');
}

export function comboFingerprintFromId(comboId: ServiceComboId): string {
  const combo = SERVICE_COMBOS.find((item) => item.id === comboId);
  return combo ? comboFingerprint(combo.services) : '';
}

/** Misma derivación que el badge: cierre comercial manda; si no, el acuse. */
export function derivarMepStatus(
  solicitud: SolicitudPreventa,
): MepSolicitudStatus {
  if (solicitud.estado.hito === 'INTERACTION_COMPLETED') {
    return 'Aprobado';
  }

  const status =
    solicitud.pista_tecnica[0]?.processing_status ?? solicitud.polling_status;

  if (status === 'REJECTED' || status === 'QUARANTINED') {
    return 'Rechazado';
  }

  if (status || solicitud.estado.hito) {
    return 'Aceptado';
  }

  return 'Pendiente';
}

/** Solo Rechazada habilita otra del mismo tipo de actividad. */
export function esSolicitudRechazada(solicitud: SolicitudPreventa): boolean {
  return derivarMepStatus(solicitud) === 'Rechazado';
}

export function comboTieneSolicitudActiva(
  solicitudes: SolicitudPreventa[],
  comboId: ServiceComboId,
): boolean {
  const key = comboFingerprintFromId(comboId);
  return solicitudes.some(
    (solicitud) =>
      comboFingerprint(solicitud.requested_services) === key &&
      !esSolicitudRechazada(solicitud),
  );
}

export { DUPLICATE_COMBO_MESSAGE };
