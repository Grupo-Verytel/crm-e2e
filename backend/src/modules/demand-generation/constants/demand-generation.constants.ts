export const DEMAND_GENERATION_ERROR_CODES = {
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  TRANSITION_PRECONDITION_FAILED: 'TRANSITION_PRECONDITION_FAILED',
  DUPLICATE_NIT: 'DUPLICATE_NIT',
  DUPLICATE_LEAD_NAME: 'DUPLICATE_LEAD_NAME',
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
  INTERACTION_DATE_TOO_OLD: 'INTERACTION_DATE_TOO_OLD',
} as const;

/** Rolling window: an interaction date cannot be older than this many hours. */
export const INTERACTION_MAX_BACKDATE_HOURS = 96;

export const LEAD_IMPORT_DUPLICATE_REASON =
  'Ya existe un lead con esta empresa y este email';

export const LEAD_IMPORT_CONTACT_ATTACHED_REASON =
  'Contacto asociado al lead de la empresa';

export const LEAD_IMPORT_SKIP_CODES = {
  DUPLICATE_ACCOUNT_EMAIL: 'DUPLICATE_ACCOUNT_EMAIL',
} as const;

/** Role names (match auth seeder Role.name) used for notification targeting. */
export const DEMAND_GENERATION_ROLES = {
  DIRECTOR_MERCADEO: 'DirectorMercadeo',
  GESTOR_MERCADEO: 'GestorMercadeo',
  SOPORTE_COMERCIAL: 'SoporteComercial',
  PRODUCT_MANAGER: 'ProductManager',
  TRADUCTOR_DE_NEGOCIO: 'TraductorDeNegocio',
  EJECUTIVO_COMERCIAL: 'EjecutivoComercial',
} as const;

export const CSV_LEAD_HEADERS = [
  'origen',
  'canal_origen',
  'segmento',
  'subsegmento',
  'city',
  'account_name',
  'tax_id',
  'contacto_nombre',
  'cargo',
  'email',
  'telefono',
  'tipo_influencia',
  'traductor',
  'campana',
] as const;

export const CSV_LEAD_REQUIRED_HEADERS = [
  'origen',
  'canal_origen',
  'segmento',
  'city',
  'account_name',
  'contacto_nombre',
  'email',
] as const;
