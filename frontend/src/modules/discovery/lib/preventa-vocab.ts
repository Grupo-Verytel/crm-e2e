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

export const SERVICE_RESULT_STATUSES = [
  'RECEIVED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;
export type ServiceResultStatus = (typeof SERVICE_RESULT_STATUSES)[number];

export const SERVICE_OUTCOMES = ['VIABLE', 'NOT_VIABLE', 'PARTIAL'] as const;
export type ServiceOutcome = (typeof SERVICE_OUTCOMES)[number];

export const ROUTE_STATUSES = [
  'VIABLE',
  'NOT_VIABLE',
  'CONDITIONED',
] as const;
export type RouteStatus = (typeof ROUTE_STATUSES)[number];

export const CAPACITY_STATUSES = [
  'PLANNED',
  'NOT_PLANNED',
  'CONDITIONED',
] as const;
export type CapacityStatus = (typeof CAPACITY_STATUSES)[number];
