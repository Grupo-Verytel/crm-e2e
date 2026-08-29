/**
 * Campos de envío de interacción CRM → Preventa (payload de request).
 * Labels en español.
 */

export type RequestField = {
  key: string;
  label: string;
  inputType?: 'text' | 'number' | 'date' | 'datetime-local' | 'textarea';
  locked?: boolean;
  lockedValue?: string;
  spanFull?: boolean;
};

/** Campos editables/visibles del formulario (requested_services se deriva del tipo). */
export const SOLICITUD_PREVENTA_FIELDS: RequestField[] = [
  { key: 'crm_interaction_ref', label: 'Referencia de interacción CRM' },
  { key: 'crm_opportunity_ref', label: 'Referencia de oportunidad CRM' },
  {
    key: 'activity_type',
    label: 'Tipo de actividad',
    locked: true,
  },
  {
    key: 'service_horizon',
    label: 'Horizonte de servicio',
    locked: true,
  },
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
  },
  { key: 'source_version', label: 'Versión de origen' },
  {
    key: 'etag',
    label: 'Fecha de respuesta',
    locked: true,
    lockedValue: '',
  },
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
    horizon: 'SHADOW',
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
 * Técnico y luego financiero → técnica activa, financiera bloqueada hasta viabilidad Preventa.
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

export function mockInteractionRef(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return `int_${(h % 90000) + 10000}`;
}
