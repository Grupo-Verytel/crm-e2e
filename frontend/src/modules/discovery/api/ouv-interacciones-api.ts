import { apiRequest } from '../../../lib/api/http-client';

/**
 * Bitácora de interacciones OUV — pestaña «Interacciones».
 *
 * Sirve la superficie `api/v1/discovery/ouvs/:ouvId/interacciones` del CRM
 * (JWT + CASL). No es la narrativa MEP: eso vive en «Solicitudes Preventa»
 * (`solicitudes-preventa-api.ts`).
 */

export type OuvInteraccionHilo = {
  ouv_interaction_reply_id: string;
  titulo: string;
  observaciones: string | null;
  fecha_registrada: string;
  registrado_por_id: string;
  registrado_por_nombre: string;
  created_at: string;
};

export type OuvInteraccion = {
  ouv_interaction_id: string;
  ouv_id: string;
  titulo: string;
  observaciones: string | null;
  /** Etiquetas de sistema, p. ej. al cerrar la OUV como Perdida/Descartada. */
  etiquetas: string[];
  fecha_registrada: string;
  registrado_por_id: string;
  registrado_por_nombre: string;
  created_at: string;
  hilos: OuvInteraccionHilo[];
};

export type CrearOuvInteraccionPayload = {
  titulo: string;
  observaciones?: string | null;
};

export function fetchOuvInteracciones(
  ouvId: string,
): Promise<OuvInteraccion[]> {
  return apiRequest<OuvInteraccion[]>(
    `/discovery/ouvs/${ouvId}/interacciones`,
  );
}

export function crearOuvInteraccion(
  ouvId: string,
  payload: CrearOuvInteraccionPayload,
): Promise<OuvInteraccion> {
  return apiRequest<OuvInteraccion>(
    `/discovery/ouvs/${ouvId}/interacciones`,
    { method: 'POST', body: payload },
  );
}

export function responderOuvInteraccion(
  ouvId: string,
  ouvInteractionId: string,
  payload: CrearOuvInteraccionPayload,
): Promise<OuvInteraccion> {
  return apiRequest<OuvInteraccion>(
    `/discovery/ouvs/${ouvId}/interacciones/${encodeURIComponent(ouvInteractionId)}/hilos`,
    { method: 'POST', body: payload },
  );
}

export function eliminarOuvInteraccion(
  ouvId: string,
  ouvInteractionId: string,
): Promise<void> {
  return apiRequest<void>(
    `/discovery/ouvs/${ouvId}/interacciones/${encodeURIComponent(ouvInteractionId)}`,
    { method: 'DELETE' },
  );
}

export function eliminarOuvInteraccionHilo(
  ouvId: string,
  ouvInteractionId: string,
  replyId: string,
): Promise<void> {
  return apiRequest<void>(
    `/discovery/ouvs/${ouvId}/interacciones/${encodeURIComponent(ouvInteractionId)}/hilos/${encodeURIComponent(replyId)}`,
    { method: 'DELETE' },
  );
}
