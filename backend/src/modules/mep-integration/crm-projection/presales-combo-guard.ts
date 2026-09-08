import { BusinessMilestone, ProcessingStatus } from '../domain/enums';

export const DUPLICATE_ACTIVITY_TYPE_MESSAGE =
  'No es posible crear una nueva solicitud para este tipo de actividad. Ya existe una solicitud activa o aprobada.';

export const DUPLICATE_ACTIVITY_TYPE_CODE = 'SOLICITUD_PREVENTA_TIPO_ACTIVO';

/** Firma estable del tipo de actividad (combo de servicios + dependencia). */
export function comboKey(
  services: Array<{ service: string; dependency: string }>,
): string {
  return [...services]
    .map((item) => `${item.service}:${item.dependency}`)
    .sort()
    .join('|');
}

type ComboStatusView = {
  estado: { hito: string | null };
  pista_tecnica: Array<{ processing_status: string }>;
  polling_status: string | null;
};

/**
 * Solo Rechazada habilita otra del mismo tipo. Pendiente, Aceptado,
 * Aprobado o cualquier otro estado bloquean.
 */
export function isSolicitudRechazada(view: ComboStatusView): boolean {
  if (view.estado.hito === BusinessMilestone.INTERACTION_COMPLETED) {
    return false;
  }

  const status = view.pista_tecnica[0]?.processing_status ?? view.polling_status;
  return (
    status === ProcessingStatus.REJECTED ||
    status === ProcessingStatus.QUARANTINED
  );
}
