/**
 * SPEC-CRM-MEPLEAN-001 §3.1 — Enumeraciones canónicas.
 *
 * Enum cerrado: cualquier valor no declarado aquí se rechaza con 422 (OPEN-01).
 * No se agregan valores "por si acaso"; ampliar exige cambio de spec.
 */

export enum ServiceHorizon {
  IMMEDIATE = 'IMMEDIATE',
  DEFERRED = 'DEFERRED',
  UNSPECIFIED = 'UNSPECIFIED',
}

export enum ServiceName {
  TECHNICAL_DESIGN = 'TECHNICAL_DESIGN',
  FINANCIAL_DESIGN = 'FINANCIAL_DESIGN',
}

export enum ServiceDependency {
  NONE = 'NONE',
  TECHNICAL_DESIGN = 'TECHNICAL_DESIGN',
  FINANCIAL_DESIGN = 'FINANCIAL_DESIGN',
}

export enum ProcessingStatus {
  ACCEPTED = 'ACCEPTED',
  DUPLICATE = 'DUPLICATE',
  QUARANTINED = 'QUARANTINED',
  REJECTED = 'REJECTED',
}

export enum BusinessMilestone {
  INTERACTION_RECEIVED = 'INTERACTION_RECEIVED',
  ENGINEER_ASSIGNED = 'ENGINEER_ASSIGNED',
  ROUTE_CAPACITY_REGISTERED = 'ROUTE_CAPACITY_REGISTERED',
  INTERACTION_COMPLETED = 'INTERACTION_COMPLETED',
}

export enum ResponseStatus {
  RECEIVED = 'RECEIVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export enum ServiceResultStatus {
  RECEIVED = 'RECEIVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ServiceOutcome {
  VIABLE = 'VIABLE',
  NOT_VIABLE = 'NOT_VIABLE',
  PARTIAL = 'PARTIAL',
}

export enum RouteStatus {
  VIABLE = 'VIABLE',
  NOT_VIABLE = 'NOT_VIABLE',
  CONDITIONED = 'CONDITIONED',
}

export enum CapacityStatus {
  PLANNED = 'PLANNED',
  NOT_PLANNED = 'NOT_PLANNED',
  CONDITIONED = 'CONDITIONED',
}

export enum OpportunityStatus {
  OPEN = 'OPEN',
  WON = 'WON',
  LOST = 'LOST',
  CANCELLED = 'CANCELLED',
}
