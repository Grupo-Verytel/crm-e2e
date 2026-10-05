import { createHash } from 'crypto';
import { resourceEtag } from './etag';

/**
 * ETag del agregado de contexto. Solo vive en la respuesta: no se persiste
 * y no incorpora `context_observed_at`, que cambia en cada lectura.
 *
 * Cubre la OUV proyectada, el reloj de solicitudes, respuestas y acuses, y
 * la bitácora `ouv_interactions` (con sus hilos), para que un `304` no oculte
 * un historial nuevo.
 */
export function ouvContextEtag(parts: {
  opportunityRef: string;
  opportunityEtag: string;
  interactionCount: number;
  interactionClock: string;
  responseClock: string;
  receiptClock: string;
  ouvInteractionCount: number;
  ouvInteractionClock: string;
  ouvReplyClock: string;
}): string {
  const canonical = [
    parts.opportunityEtag,
    String(parts.interactionCount),
    parts.interactionClock,
    parts.responseClock,
    parts.receiptClock,
    String(parts.ouvInteractionCount),
    parts.ouvInteractionClock,
    parts.ouvReplyClock,
  ].join('\n');
  const fingerprint = createHash('sha256')
    .update(canonical, 'utf8')
    .digest('hex')
    .slice(0, 32);

  return resourceEtag(`ouv-context-${parts.opportunityRef}`, fingerprint);
}
