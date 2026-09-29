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

/** Same labels as backend `PRESALES_VIABILIDAD_ETIQUETAS` (MEP projection). */
export const VIABILIDAD_PREVENTA_ETIQUETAS = {
  RUTA_VIABLE: 'Ruta viable',
  RUTA_NO_VIABLE: 'Ruta no viable',
  SERVICIO_VIABLE: 'Resultado de servicio viable',
  SERVICIO_NO_VIABLE: 'Resultado de servicio no viable',
  SERVICIO_SIN_ENTREGABLE: 'Resultado de servicio sin entregable',
} as const;

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
    return VIABILIDAD_PREVENTA_ETIQUETAS.SERVICIO_VIABLE;
  }
  if (outcome === 'NOT_VIABLE') {
    return VIABILIDAD_PREVENTA_ETIQUETAS.SERVICIO_NO_VIABLE;
  }
  if (outcome === 'PARTIAL') {
    return VIABILIDAD_PREVENTA_ETIQUETAS.SERVICIO_SIN_ENTREGABLE;
  }

  if (input.service === 'TECHNICAL_DESIGN' && input.routeStatus) {
    if (input.routeStatus === 'VIABLE' || input.routeStatus === 'CONDITIONED') {
      return VIABILIDAD_PREVENTA_ETIQUETAS.RUTA_VIABLE;
    }
    if (input.routeStatus === 'NOT_VIABLE') {
      return VIABILIDAD_PREVENTA_ETIQUETAS.RUTA_NO_VIABLE;
    }
  }

  const terminal =
    input.status === 'COMPLETED' || input.status === 'CANCELLED';
  if (terminal && input.entregablesCount === 0 && !outcome) {
    return VIABILIDAD_PREVENTA_ETIQUETAS.SERVICIO_SIN_ENTREGABLE;
  }

  return '—';
}

/**
 * `delivered_interaction_type` (MEP) — clasificación humana al cierre (INV-20).
 * Valores conocidos del catálogo Preventa; otros códigos se muestran tal cual.
 */
export const TIPO_INTERACCION_PREVENTA_LABELS: Record<string, string> = {
  'TIPO-ESTRUCTURACION': 'Estructuración',
  'TIPO-RFI': 'RFI',
  'TIPO-PROP-COMERCIAL': 'Propuesta comercial',
  'SOMBRA-INTERACCION': 'Interacción sombra',
  'TIPO-COT-PRESUP': 'Cotización / presupuesto',
  'TIPO-LICITACION': 'Licitación',
  'TIPO-MOD-FINANCIERO': 'Modelo financiero',
  'TIPO-ARQUITECTURA': 'Arquitectura',
  'TIPO-LEVANT-INF': 'Levantamiento de información',
  'TIPO-DEMO-POC': 'Demo / POC',
  'TIPO-SUSTENTACION': 'Sustentación',
  'TIPO-VISITA-TECNICA': 'Visita técnica',
  'TIPO-POR-ESPECIFICAR': 'Por especificar',
  'TIPO-AJUST-INTERAC-PREV': 'Ajuste interacción preventa',
  'TIPO-VIAB-OPORTUNIDAD': 'Viabilidad de oportunidad',
  'TIPO-ENT/SOC-PMO': 'Entrega / sociedad PMO',
  'TIPO-SIN-ENTREGABLE': 'Sin entregable',
  'TIPO-QA-TECNICO': 'QA técnico',
};

export function labelTipoInteraccionPreventa(
  code: string | null | undefined,
): string {
  if (!code) {
    return '—';
  }
  const label = TIPO_INTERACCION_PREVENTA_LABELS[code];
  if (label) {
    return `${label} (${code})`;
  }
  return code;
}

export const CAPACITY_STATUSES = [
  'PLANNED',
  'NOT_PLANNED',
  'CONDITIONED',
] as const;
export type CapacityStatus = (typeof CAPACITY_STATUSES)[number];
