/**
 * Rutas literales de las 6 operaciones — SPEC-CRM-MEPLEAN-001 §5.
 *
 * El CRM sirve el resto de su API bajo el prefijo global `api/v1`; el contrato
 * con MEP-LEAN vive en `/v1`, así que estas rutas se excluyen del prefijo en
 * `main.ts`. La lista es la fuente única de esa exclusión: agregar una
 * operación al contrato exige agregarla aquí, o su ruta quedaría publicada en
 * `/api/v1/v1/...` en vez de `/v1/...`.
 */
export const MEP_CONTRACT_ROUTES = [
  // 1. Intake — pull paginado
  'v1/commercial-interactions',
  // 2. Intake — relectura por identidad
  'v1/commercial-interactions/:interaction_ref',
  // 3. Opportunity — contexto de OUV
  'v1/commercial-opportunities/:opportunity_ref',
  // 4. Processing — acuse técnico
  'v1/commercial-interactions/:interaction_ref/processing-receipts',
  // 5 y 6. Response — publicación y verificación post-write
  'v1/commercial-interactions/:interaction_ref/responses/:response_id',
] as const;
