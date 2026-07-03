export type LeadEstado =
  | 'Nuevo'
  | 'TOFU'
  | 'MOFU'
  | 'MQL_PENDING'
  | 'SQL'
  | 'Reciclaje'
  | 'Descartado';

export const LEAD_ESTADOS: LeadEstado[] = [
  'Nuevo',
  'TOFU',
  'MOFU',
  'MQL_PENDING',
  'SQL',
  'Reciclaje',
  'Descartado',
];

export type Segmento = 'Gobierno' | 'D&S' | 'ProyectosEspeciales' | 'B2B';
export const SEGMENTOS: Segmento[] = ['Gobierno', 'D&S', 'ProyectosEspeciales', 'B2B'];

export type SegmentoObjetivo = Segmento | 'Todos';
export const SEGMENTOS_OBJETIVO: SegmentoObjetivo[] = [...SEGMENTOS, 'Todos'];

export type TipoLead = 'Inbound' | 'Outbound' | 'Referido' | 'Aliado' | 'Licitacion';
export const TIPOS_LEAD: TipoLead[] = [
  'Inbound',
  'Outbound',
  'Referido',
  'Aliado',
  'Licitacion',
];

export type OrigenLead =
  | 'Web'
  | 'Email'
  | 'LinkedIn'
  | 'Evento'
  | 'SECOP'
  | 'Aliado'
  | 'Otro'
  | 'Referido';
export const ORIGENES_LEAD: OrigenLead[] = [
  'Web',
  'Email',
  'LinkedIn',
  'Evento',
  'SECOP',
  'Aliado',
  'Otro',
  'Referido',
];

export type CampaignEstado =
  | 'Borrador'
  | 'Activa'
  | 'Pausada'
  | 'Finalizada'
  | 'Cancelada';
export const CAMPAIGN_ESTADOS: CampaignEstado[] = [
  'Borrador',
  'Activa',
  'Pausada',
  'Finalizada',
  'Cancelada',
];

export type CampaignTipo =
  | 'Email'
  | 'LinkedIn'
  | 'Evento'
  | 'WebinarPaid'
  | 'Outbound'
  | 'Aliado';
export const CAMPAIGN_TIPOS: CampaignTipo[] = [
  'Email',
  'LinkedIn',
  'Evento',
  'WebinarPaid',
  'Outbound',
  'Aliado',
];

export type CampaignObjetivo =
  | 'Awareness'
  | 'LeadGen'
  | 'Nurturing'
  | 'Reactivacion';
export const CAMPAIGN_OBJETIVOS: CampaignObjetivo[] = [
  'Awareness',
  'LeadGen',
  'Nurturing',
  'Reactivacion',
];

export type MqlEstado = 'Activo' | 'ConvertidoSQL' | 'Devuelto' | 'Descartado';

export type InteractionTipo =
  | 'Email'
  | 'Llamada'
  | 'Reunion'
  | 'Webinar'
  | 'Descarga'
  | 'VisitaWeb';
export const INTERACTION_TIPOS: InteractionTipo[] = [
  'Email',
  'Llamada',
  'Reunion',
  'Webinar',
  'Descarga',
  'VisitaWeb',
];

export type InteractionCanal =
  | 'Email'
  | 'Telefono'
  | 'LinkedIn'
  | 'Presencial'
  | 'Web'
  | 'Otro';
export const INTERACTION_CANALES: InteractionCanal[] = [
  'Email',
  'Telefono',
  'LinkedIn',
  'Presencial',
  'Web',
  'Otro',
];

export type InteractionResultado =
  | 'Positivo'
  | 'Neutro'
  | 'Negativo'
  | 'SinRespuesta';
export const INTERACTION_RESULTADOS: InteractionResultado[] = [
  'Positivo',
  'Neutro',
  'Negativo',
  'SinRespuesta',
];

export type Lead = {
  lead_id: string;
  tipo_lead: string;
  origen: string;
  sub_origen: string | null;
  campana_id: string | null;
  segmento: string;
  industria: string | null;
  region: string;
  pais: string;
  empresa_nombre: string;
  nit: string | null;
  contacto_nombre: string;
  cargo: string | null;
  email: string;
  telefono: string | null;
  tipo_influencia: string | null;
  estado: LeadEstado;
  icp_score: number | null;
  responsable_id: string;
  motivo_descarte: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  fecha_captura: string;
  fecha_ultima_interaccion: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type PaginatedLeads = {
  items: Lead[];
  total: number;
  page: number;
  limit: number;
};

export type LeadsQuery = {
  estado?: LeadEstado;
  segmento?: Segmento;
  campana_id?: string;
  responsable_id?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export type CreateLeadPayload = {
  tipo_lead: TipoLead;
  origen: OrigenLead;
  segmento: Segmento;
  industria?: string;
  region: string;
  pais: string;
  empresa_nombre: string;
  nit?: string;
  contacto_nombre: string;
  cargo?: string;
  email: string;
  telefono?: string;
  responsable_id: string;
  campana_id?: string;
  sub_origen?: string;
};

export type Interaction = {
  interaction_id: string;
  lead_id: string;
  tipo: string;
  subtipo: string | null;
  canal: string;
  descripcion: string | null;
  resultado: string | null;
  campana_id: string | null;
  responsable_id: string;
  fecha: string;
  created_at: string;
  updated_at: string;
};

export type CreateInteractionPayload = {
  tipo: InteractionTipo;
  canal: InteractionCanal;
  subtipo?: string;
  descripcion?: string;
  resultado?: InteractionResultado;
  campana_id?: string;
  fecha?: string;
};

export type Checklist = {
  checklist_id: string;
  lead_id: string;
  criterio_sector_objetivo: boolean;
  criterio_necesidad_portafolio: boolean;
  criterio_acceso_decisor: boolean;
  criterio_presupuesto_indicios: boolean;
  resultado: 'Calificado' | 'NoCalificado';
  completado_por: string;
  fecha_completado: string | null;
  created_at: string;
  updated_at: string;
};

export type UpdateChecklistPayload = {
  criterio_sector_objetivo?: boolean;
  criterio_necesidad_portafolio?: boolean;
  criterio_acceso_decisor?: boolean;
  criterio_presupuesto_indicios?: boolean;
};

export type Campaign = {
  campana_id: string;
  nombre: string;
  tipo: string;
  canal: string;
  objetivo: string;
  segmento_objetivo: string;
  responsable_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  presupuesto: string | null;
  gasto_real: string | null;
  estado: CampaignEstado;
  leads_generados: number;
  cpl: string | null;
  created_at: string;
  updated_at: string;
};

export type PaginatedCampaigns = {
  items: Campaign[];
  total: number;
  page: number;
  limit: number;
};

export type CampaignsQuery = {
  estado?: CampaignEstado;
  tipo?: CampaignTipo;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export type CreateCampaignPayload = {
  nombre: string;
  tipo: CampaignTipo;
  canal: string;
  objetivo: CampaignObjetivo;
  segmento_objetivo: SegmentoObjetivo;
  responsable_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  presupuesto?: number;
  gasto_real?: number;
};

export type Mql = {
  mql_id: string;
  lead_id: string;
  checklist_id: string;
  calificado_por: string;
  fecha_calificacion: string;
  motivo_calificacion: string | null;
  estado: MqlEstado;
  created_at: string;
  updated_at: string;
};

export type PaginatedMqls = {
  items: Mql[];
  total: number;
  page: number;
  limit: number;
};

export type MqlsQuery = {
  estado?: MqlEstado;
  page?: number;
  limit?: number;
};

export type ImportJobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export type BulkImportJobAccepted = {
  job_id: string;
  status: ImportJobStatus;
};

export type BulkImportSkippedRow = {
  row: number;
  email: string;
  nit: string | null;
  reason: string;
};

export type BulkImportJobStatus = {
  job_id: string;
  status: ImportJobStatus;
  total_rows: number;
  created: number;
  skipped: BulkImportSkippedRow[];
  created_lead_ids: string[];
  error: string | null;
  started_at: string;
  finished_at: string | null;
};

export type MarketingDashboard = {
  total_leads: number;
  leads_by_segment: { segmento: string; count: number }[];
  qualified_rate: number;
  average_cpl: number | null;
  pending_mqls: number;
  funnel: { estado: string; count: number }[];
};
