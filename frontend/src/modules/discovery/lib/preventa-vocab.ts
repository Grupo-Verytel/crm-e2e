/**
 * Vocabulario de solicitudes de preventa — SPEC-CRM-MEPLEAN-001.
 *
 * Los valores son los del contrato (§3.1); las etiquetas, español para la UI.
 * Ningún componente arma strings de enum a mano: si un valor no está acá, el
 * backend lo rechaza con 422.
 */

export const ACTIVITY_PRIORITIES = ['ASAP', 'SOMBRA'] as const;
export type ActivityPriority = (typeof ACTIVITY_PRIORITIES)[number];

export const ACTIVITY_PRIORITY_LABEL: Record<ActivityPriority, string> = {
  ASAP: 'ASAP',
  SOMBRA: 'Sombra',
};

export const ACTIVITY_PRIORITY_HINT: Record<ActivityPriority, string> = {
  ASAP: 'Atención inmediata de la fábrica de preventa.',
  SOMBRA: 'Trabajo diferido, sin compromiso de atención inmediata.',
};

/** Los 4 casos de forma válida de `requested_services[]` (§7.6, C-1..C-4). */
export const SERVICE_COMBOS = [
  'technical',
  'financial',
  'technical_and_financial',
  'technical_then_financial',
] as const;
export type ServiceCombo = (typeof SERVICE_COMBOS)[number];

export const SERVICE_COMBO_LABEL: Record<ServiceCombo, string> = {
  technical: 'Técnica',
  financial: 'Financiera',
  technical_and_financial: 'Técnico y financiero',
  technical_then_financial: 'Técnico y luego financiero',
};

export const SERVICE_COMBO_HINT: Record<ServiceCombo, string> = {
  technical: 'Solo diseño técnico.',
  financial: 'Modelo financiero directo, sin fase técnica previa.',
  technical_and_financial: 'Ambos en paralelo, independientes entre sí.',
  technical_then_financial:
    'El financiero arranca cuando el técnico entrega su resultado.',
};

export type ServiceName = 'TECHNICAL_DESIGN' | 'FINANCIAL_DESIGN';

export const SERVICE_LABEL: Record<ServiceName, string> = {
  TECHNICAL_DESIGN: 'Técnica',
  FINANCIAL_DESIGN: 'Financiera',
};

export type ServiceHorizon = 'IMMEDIATE' | 'DEFERRED' | 'UNSPECIFIED';

export const SERVICE_HORIZON_LABEL: Record<ServiceHorizon, string> = {
  IMMEDIATE: 'Inmediato',
  DEFERRED: 'Diferido',
  UNSPECIFIED: 'Sin especificar',
};

/** Los 4 hitos comerciales, en su orden no regresivo (§7.1). */
export const BUSINESS_MILESTONES = [
  'INTERACTION_RECEIVED',
  'ENGINEER_ASSIGNED',
  'ROUTE_CAPACITY_REGISTERED',
  'INTERACTION_COMPLETED',
] as const;
export type BusinessMilestone = (typeof BUSINESS_MILESTONES)[number];

export const MILESTONE_LABEL: Record<BusinessMilestone, string> = {
  INTERACTION_RECEIVED: 'Recibida',
  ENGINEER_ASSIGNED: 'Ingeniero asignado',
  ROUTE_CAPACITY_REGISTERED: 'Ruta y capacidad registradas',
  INTERACTION_COMPLETED: 'Completada',
};

export type ServiceResultStatus =
  | 'RECEIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export const SERVICE_STATUS_LABEL: Record<ServiceResultStatus, string> = {
  RECEIVED: 'Recibido',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

export type ServiceOutcome = 'VIABLE' | 'NOT_VIABLE' | 'PARTIAL';

export const SERVICE_OUTCOME_LABEL: Record<ServiceOutcome, string> = {
  VIABLE: 'Viable',
  NOT_VIABLE: 'No viable',
  PARTIAL: 'Parcial',
};

export type RouteStatus = 'VIABLE' | 'NOT_VIABLE' | 'CONDITIONED';
export type CapacityStatus = 'PLANNED' | 'NOT_PLANNED' | 'CONDITIONED';

export const ROUTE_STATUS_LABEL: Record<RouteStatus, string> = {
  VIABLE: 'Ruta viable',
  NOT_VIABLE: 'Ruta no viable',
  CONDITIONED: 'Ruta condicionada',
};

export const CAPACITY_STATUS_LABEL: Record<CapacityStatus, string> = {
  PLANNED: 'Capacidad planificada',
  NOT_PLANNED: 'Capacidad no planificada',
  CONDITIONED: 'Capacidad condicionada',
};

/**
 * Acuse técnico de MEP. Es un hecho de **transporte**, no un hito comercial
 * (INV-12): la UI lo muestra en una pista aparte y jamás como estado de la
 * solicitud.
 */
export type ProcessingStatus =
  | 'ACCEPTED'
  | 'DUPLICATE'
  | 'QUARANTINED'
  | 'REJECTED';

export const PROCESSING_STATUS_LABEL: Record<ProcessingStatus, string> = {
  ACCEPTED: 'Aceptado',
  DUPLICATE: 'Duplicado',
  QUARANTINED: 'En cuarentena',
  REJECTED: 'Rechazado',
};

/** Tono visual por estado; las clases concretas viven en los componentes. */
export type Tone = 'brand' | 'positive' | 'danger' | 'warning' | 'neutral';

export const MILESTONE_TONE: Record<BusinessMilestone, Tone> = {
  INTERACTION_RECEIVED: 'neutral',
  ENGINEER_ASSIGNED: 'brand',
  ROUTE_CAPACITY_REGISTERED: 'brand',
  INTERACTION_COMPLETED: 'positive',
};

export const SERVICE_STATUS_TONE: Record<ServiceResultStatus, Tone> = {
  RECEIVED: 'neutral',
  IN_PROGRESS: 'brand',
  COMPLETED: 'positive',
  CANCELLED: 'danger',
};

export const OUTCOME_TONE: Record<ServiceOutcome, Tone> = {
  VIABLE: 'positive',
  NOT_VIABLE: 'danger',
  PARTIAL: 'warning',
};

export const PROCESSING_STATUS_TONE: Record<ProcessingStatus, Tone> = {
  ACCEPTED: 'positive',
  DUPLICATE: 'neutral',
  QUARANTINED: 'warning',
  REJECTED: 'danger',
};
