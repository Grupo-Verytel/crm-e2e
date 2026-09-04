/**
 * Scopes por operación — §10.2.
 *
 * Clave ausente/inválida/revocada/expirada → 401 genérico.
 * Clave válida sin el scope → 403 INSUFFICIENT_SCOPE.
 * P-01: la identidad MEP no tiene ningún scope de escritura sobre el modelo
 * comercial del CRM; solo publica hechos observados.
 */
export const MEP_SCOPES = {
  INTERACTIONS_READ: 'interactions:read',
  OPPORTUNITIES_READ: 'opportunities:read',
  RECEIPTS_WRITE: 'receipts:write',
  RESPONSES_WRITE: 'responses:write',
  RESPONSES_READ: 'responses:read',
  /** Scope interno de consulta de auditoría; nunca se otorga a MEP (§12.3). */
  AUDIT_READ: 'audit:read',
} as const;

export type MepScope = (typeof MEP_SCOPES)[keyof typeof MEP_SCOPES];

/** Conjunto de scopes que se otorgan a la identidad `mep-lean`. */
export const MEP_LEAN_DEFAULT_SCOPES: MepScope[] = [
  MEP_SCOPES.INTERACTIONS_READ,
  MEP_SCOPES.OPPORTUNITIES_READ,
  MEP_SCOPES.RECEIPTS_WRITE,
  MEP_SCOPES.RESPONSES_WRITE,
  MEP_SCOPES.RESPONSES_READ,
];
