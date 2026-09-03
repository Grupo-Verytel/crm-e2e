/**
 * SPEC-CRM-MEPLEAN-001 §5.3 / §5.4 — Catálogo de errores y formato RFC 7807.
 *
 * INV-02: el cuerpo de error nunca incluye `source_content`, valores de
 * `X-API-Key`, ni identificadores internos de MEP.
 */

export const PROBLEM_BASE_URI = 'https://api.frisson.crm/problems';

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/** Códigos de error del contrato. Se serializan tal cual en `code`. */
export const MEP_ERROR_CODES = {
  // ERR-400
  MALFORMED_REQUEST: 'MALFORMED_REQUEST',
  INVALID_CURSOR: 'INVALID_CURSOR',
  CURSOR_EXPIRED: 'CURSOR_EXPIRED',
  INVALID_LIMIT: 'INVALID_LIMIT',
  INVALID_IDEMPOTENCY_KEY: 'INVALID_IDEMPOTENCY_KEY',
  MISSING_IDEMPOTENCY_KEY: 'MISSING_IDEMPOTENCY_KEY',
  MISSING_CORRELATION_ID: 'MISSING_CORRELATION_ID',
  // ERR-401 / ERR-403
  UNAUTHORIZED: 'UNAUTHORIZED',
  INSUFFICIENT_SCOPE: 'INSUFFICIENT_SCOPE',
  // ERR-404
  NOT_FOUND: 'NOT_FOUND',
  // ERR-409
  IDEMPOTENCY_KEY_REUSE: 'IDEMPOTENCY_KEY_REUSE',
  REQUEST_IN_FLIGHT: 'REQUEST_IN_FLIGHT',
  VERSION_CONTENT_CONFLICT: 'VERSION_CONTENT_CONFLICT',
  RECEIPT_CONTENT_CONFLICT: 'RECEIPT_CONTENT_CONFLICT',
  // ERR-412
  PRECONDITION_FAILED: 'PRECONDITION_FAILED',
  // ERR-413 / ERR-415 / ERR-426 (§10.3)
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  HTTPS_REQUIRED: 'HTTPS_REQUIRED',
  // ERR-422 — semánticos
  UNKNOWN_PROPERTY: 'UNKNOWN_PROPERTY',
  UNKNOWN_ENUM_VALUE: 'UNKNOWN_ENUM_VALUE',
  INVERTED_SERVICE_DEPENDENCY: 'INVERTED_SERVICE_DEPENDENCY',
  DUPLICATE_SERVICE: 'DUPLICATE_SERVICE',
  INVALID_SERVICE_OUTCOME: 'INVALID_SERVICE_OUTCOME',
  MISSING_REASON_CODE: 'MISSING_REASON_CODE',
  DELIVERABLE_NOT_A_DOCUMENT: 'DELIVERABLE_NOT_A_DOCUMENT',
  MILESTONE_REGRESSION: 'MILESTONE_REGRESSION',
  INTERACTION_ALREADY_COMPLETED: 'INTERACTION_ALREADY_COMPLETED',
  MILESTONE_REQUIREMENTS_NOT_MET: 'MILESTONE_REQUIREMENTS_NOT_MET',
  INVALID_RESPONSE_STATUS: 'INVALID_RESPONSE_STATUS',
  NON_MONOTONIC_VERSION: 'NON_MONOTONIC_VERSION',
  RESPONSE_ID_MISMATCH: 'RESPONSE_ID_MISMATCH',
  RESPONSE_ID_NOT_STABLE: 'RESPONSE_ID_NOT_STABLE',
  PREMATURE_CLASSIFICATION: 'PREMATURE_CLASSIFICATION',
  PROVISIONAL_CLASSIFICATION: 'PROVISIONAL_CLASSIFICATION',
  MISSING_CLASSIFICATION: 'MISSING_CLASSIFICATION',
  INSECURE_URL: 'INSECURE_URL',
  // ERR-429 / ERR-503
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  AUDIT_WRITE_FAILED: 'AUDIT_WRITE_FAILED',
} as const;

export type MepErrorCode =
  (typeof MEP_ERROR_CODES)[keyof typeof MEP_ERROR_CODES];

/** Slug de `type` (URI del problema) por código. */
const PROBLEM_SLUGS: Record<string, string> = {
  MALFORMED_REQUEST: 'malformed-request',
  INVALID_CURSOR: 'invalid-cursor',
  CURSOR_EXPIRED: 'cursor-expired',
  INVALID_LIMIT: 'invalid-limit',
  INVALID_IDEMPOTENCY_KEY: 'invalid-idempotency-key',
  MISSING_IDEMPOTENCY_KEY: 'missing-idempotency-key',
  MISSING_CORRELATION_ID: 'missing-correlation-id',
  UNAUTHORIZED: 'unauthorized',
  INSUFFICIENT_SCOPE: 'insufficient-scope',
  NOT_FOUND: 'not-found',
  IDEMPOTENCY_KEY_REUSE: 'idempotency-key-reuse',
  REQUEST_IN_FLIGHT: 'request-in-flight',
  VERSION_CONTENT_CONFLICT: 'version-content-conflict',
  RECEIPT_CONTENT_CONFLICT: 'receipt-content-conflict',
  PRECONDITION_FAILED: 'precondition-failed',
  PAYLOAD_TOO_LARGE: 'payload-too-large',
  UNSUPPORTED_MEDIA_TYPE: 'unsupported-media-type',
  HTTPS_REQUIRED: 'https-required',
  UNKNOWN_PROPERTY: 'unknown-property',
  UNKNOWN_ENUM_VALUE: 'unknown-enum-value',
  INVERTED_SERVICE_DEPENDENCY: 'inverted-dependency',
  DUPLICATE_SERVICE: 'duplicate-service',
  INVALID_SERVICE_OUTCOME: 'invalid-service-outcome',
  MISSING_REASON_CODE: 'missing-reason-code',
  DELIVERABLE_NOT_A_DOCUMENT: 'deliverable-not-a-document',
  MILESTONE_REGRESSION: 'milestone-regression',
  INTERACTION_ALREADY_COMPLETED: 'interaction-already-completed',
  MILESTONE_REQUIREMENTS_NOT_MET: 'milestone-requirements-not-met',
  INVALID_RESPONSE_STATUS: 'invalid-response-status',
  NON_MONOTONIC_VERSION: 'non-monotonic-version',
  RESPONSE_ID_MISMATCH: 'response-id-mismatch',
  RESPONSE_ID_NOT_STABLE: 'response-id-not-stable',
  PREMATURE_CLASSIFICATION: 'premature-classification',
  PROVISIONAL_CLASSIFICATION: 'provisional-classification',
  MISSING_CLASSIFICATION: 'missing-classification',
  INSECURE_URL: 'insecure-url',
  RATE_LIMIT_EXCEEDED: 'rate-limit',
  SERVICE_UNAVAILABLE: 'service-unavailable',
  AUDIT_WRITE_FAILED: 'audit-write-failed',
};

/** `title` en español, alineado con §5.4. */
const PROBLEM_TITLES: Record<number, string> = {
  400: 'Solicitud mal formada',
  401: 'Credencial ausente o inválida',
  403: 'Permiso insuficiente',
  404: 'Recurso inexistente',
  409: 'Conflicto de escritura',
  412: 'Precondición fallida',
  413: 'Cuerpo de la solicitud demasiado grande',
  415: 'Tipo de contenido no soportado',
  422: 'Contenido semánticamente inválido',
  426: 'Se requiere HTTPS',
  429: 'Cuota temporal excedida',
  503: 'Error transitorio del CRM',
};

export function problemType(code: string): string {
  return `${PROBLEM_BASE_URI}/${PROBLEM_SLUGS[code] ?? 'unknown'}`;
}

export function problemTitle(status: number): string {
  return PROBLEM_TITLES[status] ?? 'Error';
}

/** Puntero JSON + código, tal como aparece en `errors[]` (§5.4). */
export interface ProblemErrorItem {
  pointer: string;
  code: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code: string;
  correlation_id?: string;
  errors?: ProblemErrorItem[];
}
