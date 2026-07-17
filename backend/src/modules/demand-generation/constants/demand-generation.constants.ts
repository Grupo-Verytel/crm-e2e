export const DEMAND_GENERATION_ERROR_CODES = {
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  TRANSITION_PRECONDITION_FAILED: 'TRANSITION_PRECONDITION_FAILED',
  DUPLICATE_NIT: 'DUPLICATE_NIT',
  DUPLICATE_CAMPAIGN_NAME: 'DUPLICATE_CAMPAIGN_NAME',
  CAMPAIGN_NOT_FOUND: 'CAMPAIGN_NOT_FOUND',
  CAMPAIGN_CLOSED: 'CAMPAIGN_CLOSED',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  RECYCLE_NOT_ALLOWED: 'RECYCLE_NOT_ALLOWED',
  CHECKLIST_NOT_FOUND: 'CHECKLIST_NOT_FOUND',
  CHECKLIST_INCOMPLETE: 'CHECKLIST_INCOMPLETE',
  LEAD_LOCKED: 'LEAD_LOCKED',
  MQL_NOT_FOUND: 'MQL_NOT_FOUND',
  MQL_NOT_ACTIVE: 'MQL_NOT_ACTIVE',
  APPOINTMENT_NOT_ALLOWED: 'APPOINTMENT_NOT_ALLOWED',
  IMPORT_JOB_NOT_FOUND: 'IMPORT_JOB_NOT_FOUND',
} as const;

/** Role names (match auth seeder Role.name) used for notification targeting. */
export const DEMAND_GENERATION_ROLES = {
  DIRECTOR_MERCADEO: 'DirectorMercadeo',
  GESTOR_MERCADEO: 'GestorMercadeo',
  SOPORTE_COMERCIAL: 'SoporteComercial',
} as const;

export const CSV_LEAD_HEADERS = [
  'tipo_lead',
  'origen',
  'canal_origen',
  'segmento',
  'industria',
  'region',
  'pais',
  'empresa_nombre',
  'nit',
  'contacto_nombre',
  'cargo',
  'email',
  'telefono',
  'responsable_id',
  'campana_id',
] as const;
