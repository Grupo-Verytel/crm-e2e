/**
 * Campos y catálogos del envío de interacción CRM → Preventa.
 *
 * Traído de la rama `Design_JD` conservando su estructura. Dos ajustes
 * obligados por el contrato (SPEC-CRM-MEPLEAN-001), documentados en su lugar:
 * el horizonte de `SOMBRA` y la generación de `crm_interaction_ref`.
 */

export type RequestField = {
  key: string;
  label: string;
  inputType?: 'text' | 'number' | 'date' | 'datetime-local' | 'textarea';
  locked?: boolean;
  lockedValue?: string;
  spanFull?: boolean;
};

/** Campos visibles del formulario; `requested_services` se deriva del tipo. */
export const SOLICITUD_PREVENTA_FIELDS: RequestField[] = [
  {
    key: 'crm_interaction_ref',
    label: 'Referencia de interacción CRM',
    // Autoridad del CRM (§4): la asigna el backend al crear la solicitud.
    locked: true,
  },
  { key: 'crm_opportunity_ref', label: 'Referencia de oportunidad CRM', locked: true },
  { key: 'activity_type', label: 'Tipo de actividad', locked: true },
  { key: 'service_horizon', label: 'Horizonte de servicio', locked: true },
  { key: 'subject', label: 'Asunto', spanFull: true },
  {
    key: 'source_content',
    label: 'Contenido de origen',
    inputType: 'textarea',
    spanFull: true,
  },
  {
    key: 'source_created_at',
    label: 'Origen creado en',
    inputType: 'datetime-local',
    locked: true,
  },
  { key: 'source_version', label: 'Versión de origen', locked: true },
  { key: 'etag', label: 'Versión del recurso (ETag)', locked: true, lockedValue: '' },
];

export type ActivityPriority = 'ASAP' | 'SOMBRA';

export const ACTIVITY_PRIORITY_OPTIONS: {
  id: ActivityPriority;
  name: string;
  horizon: string;
  activityType: string;
}[] = [
  {
    id: 'ASAP',
    name: 'ASAP',
    horizon: 'IMMEDIATE',
    activityType: 'interaccion_asap',
  },
  {
    id: 'SOMBRA',
    name: 'Sombra',
    // El diseño traía `SHADOW`, que no existe en `ServiceHorizon` (§3.1:
    // IMMEDIATE | DEFERRED | UNSPECIFIED) y el contrato rechaza con 422.
    // `DEFERRED` es el horizonte diferido del spec.
    horizon: 'DEFERRED',
    activityType: 'interaccion_sombra',
  },
];

export type RequestedService = {
  service: string;
  dependency: string;
};

export type ServiceComboId =
  | 'technical'
  | 'financial'
  | 'technical_and_financial'
  | 'technical_then_financial';

export type ServiceCombo = {
  id: ServiceComboId;
  name: string;
  services: RequestedService[];
};

export const SERVICE_LABELS: Record<string, string> = {
  TECHNICAL_DESIGN: 'Técnica',
  FINANCIAL_DESIGN: 'Financiera',
};

/** Los 4 casos de forma válida de `requested_services[]` (§7.6, C-1..C-4). */
export const SERVICE_COMBOS: ServiceCombo[] = [
  {
    id: 'technical',
    name: 'Técnica',
    services: [{ service: 'TECHNICAL_DESIGN', dependency: 'NONE' }],
  },
  {
    id: 'financial',
    name: 'Financiera',
    services: [{ service: 'FINANCIAL_DESIGN', dependency: 'NONE' }],
  },
  {
    id: 'technical_and_financial',
    name: 'Técnico y financiero',
    services: [
      { service: 'TECHNICAL_DESIGN', dependency: 'NONE' },
      { service: 'FINANCIAL_DESIGN', dependency: 'NONE' },
    ],
  },
  {
    id: 'technical_then_financial',
    name: 'Técnico y luego financiero',
    services: [
      { service: 'TECHNICAL_DESIGN', dependency: 'NONE' },
      { service: 'FINANCIAL_DESIGN', dependency: 'TECHNICAL_DESIGN' },
    ],
  },
];

/** Estado visual de cada servicio dentro de una solicitud. */
export type ServiceCardState = 'active' | 'blocked';

export type ServiceCard = {
  service: string;
  label: string;
  dependency: string;
  state: ServiceCardState;
};

/**
 * Técnico y financiero → ambas activas, mismo contenedor.
 * Técnico y luego financiero → técnica activa, financiera bloqueada hasta
 * viabilidad Preventa.
 */
export function buildServiceCards(comboId: ServiceComboId): ServiceCard[] {
  const combo = SERVICE_COMBOS.find((c) => c.id === comboId);
  if (!combo) return [];

  return combo.services.map((svc) => {
    let state: ServiceCardState = 'active';
    if (
      comboId === 'technical_then_financial' &&
      svc.service === 'FINANCIAL_DESIGN'
    ) {
      state = 'blocked';
    }
    return {
      service: svc.service,
      label: SERVICE_LABELS[svc.service] ?? svc.service,
      dependency: svc.dependency,
      state,
    };
  });
}
