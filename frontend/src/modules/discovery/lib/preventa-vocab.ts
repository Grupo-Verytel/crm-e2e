/**
 * Canonical Preventa / MEP enumerations for the CRM UI.
 * Mirrors `backend/src/modules/mep-integration/domain/enums.ts` and
 * `presales-vocabulary.ts` as string unions (JSON over REST).
 */

export const ACTIVITY_PRIORITIES = ['ASAP', 'SOMBRA'] as const;
export type ActivityPriority = (typeof ACTIVITY_PRIORITIES)[number];

export const SERVICE_HORIZONS = [
  'IMMEDIATE',
  'DEFERRED',
  'UNSPECIFIED',
] as const;
export type ServiceHorizon = (typeof SERVICE_HORIZONS)[number];

export const SERVICE_NAMES = [
  'TECHNICAL_DESIGN',
  'FINANCIAL_DESIGN',
] as const;
export type ServiceName = (typeof SERVICE_NAMES)[number];

export const SERVICE_COMBOS = [
  'technical',
  'financial',
  'technical_and_financial',
  'technical_then_financial',
] as const;
export type ServiceCombo = (typeof SERVICE_COMBOS)[number];

export const PROCESSING_STATUSES = [
  'ACCEPTED',
  'DUPLICATE',
  'QUARANTINED',
  'REJECTED',
] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export const BUSINESS_MILESTONES = [
  'INTERACTION_RECEIVED',
  'ENGINEER_ASSIGNED',
  'ROUTE_CAPACITY_REGISTERED',
  'INTERACTION_COMPLETED',
] as const;
export type BusinessMilestone = (typeof BUSINESS_MILESTONES)[number];

export const RESPONSE_STATUSES = [
  'RECEIVED',
  'IN_PROGRESS',
  'PARTIALLY_COMPLETED',
  'COMPLETED',
  'CANCELLED',
] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];

export const RESPONSE_STATUS_LABELS: Record<ResponseStatus, string> = {
  RECEIVED: 'Recibida',
  IN_PROGRESS: 'En progreso',
  PARTIALLY_COMPLETED: 'Parcialmente completo',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
};

export function labelResponseStatus(
  status: ResponseStatus | string | null | undefined,
): string {
  if (!status) {
    return '—';
  }
  return RESPONSE_STATUS_LABELS[status as ResponseStatus] ?? status;
}

export const SERVICE_RESULT_STATUSES = [
  'RECEIVED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;
export type ServiceResultStatus = (typeof SERVICE_RESULT_STATUSES)[number];

export const SERVICE_OUTCOMES = [
  'VIABLE',
  'NOT_VIABLE',
  'PARTIAL',
  'CONDITIONED',
] as const;
export type ServiceOutcome = (typeof SERVICE_OUTCOMES)[number];

export const ROUTE_STATUSES = [
  'VIABLE',
  'NOT_VIABLE',
  'CONDITIONED',
] as const;
export type RouteStatus = (typeof ROUTE_STATUSES)[number];

/** UI labels for `route_capacity.route_status` from MEP responses. */
export const ROUTE_STATUS_LABELS: Record<RouteStatus, string> = {
  VIABLE: 'Ruta Viable',
  NOT_VIABLE: 'Ruta No Viable',
  CONDITIONED: 'Ruta Condicionada',
};

export function labelRouteStatus(
  status: RouteStatus | string | null | undefined,
): string {
  if (!status) {
    return '—';
  }
  return ROUTE_STATUS_LABELS[status as RouteStatus] ?? status;
}

export const SERVICE_OUTCOME_LABELS: Record<ServiceOutcome, string> = {
  VIABLE: 'Viable',
  NOT_VIABLE: 'No viable',
  PARTIAL: 'Parcial',
  CONDITIONED: 'Condicionado',
};

export function labelServiceOutcome(
  outcome: ServiceOutcome | string | null | undefined,
): string {
  if (!outcome) {
    return '—';
  }
  return SERVICE_OUTCOME_LABELS[outcome as ServiceOutcome] ?? outcome;
}

/** Viabilidad unificada en detalle Preventa (ruta vs resultado de servicio). */
export type ViabilidadPreventaInput = {
  service: string;
  outcome: ServiceOutcome | string | null | undefined;
  status: ServiceResultStatus | string | null | undefined;
  entregablesCount: number;
  routeStatus: RouteStatus | string | null | undefined;
};

export function labelViabilidadPreventa(input: ViabilidadPreventaInput): string {
  const outcome = input.outcome;

  if (outcome === 'VIABLE' || outcome === 'CONDITIONED') {
    return 'Resultado de servicio viable';
  }
  if (outcome === 'NOT_VIABLE') {
    return 'Resultado de servicio no viable';
  }
  if (outcome === 'PARTIAL') {
    return 'Resultado de servicio sin entregable';
  }

  if (input.service === 'TECHNICAL_DESIGN' && input.routeStatus) {
    if (input.routeStatus === 'VIABLE' || input.routeStatus === 'CONDITIONED') {
      return 'Ruta viable';
    }
    if (input.routeStatus === 'NOT_VIABLE') {
      return 'Ruta no viable';
    }
  }

  const terminal =
    input.status === 'COMPLETED' || input.status === 'CANCELLED';
  if (terminal && input.entregablesCount === 0 && !outcome) {
    return 'Resultado de servicio sin entregable';
  }

  return '—';
}

export const CAPACITY_STATUSES = [
  'PLANNED',
  'NOT_PLANNED',
  'CONDITIONED',
] as const;
export type CapacityStatus = (typeof CAPACITY_STATUSES)[number];
