import { apiRequest } from '../../../lib/api/http-client';
import { buildQueryString } from '../../../lib/format';

export type SqlCita = {
  cita_id: string;
  sql_id: string;
  lugar: string;
  fecha: string;
  hora: string;
  contacto_nombre: string;
  contacto_cargo: string | null;
  descripcion: string | null;
  agendada_por: string;
  created_at: string;
  updated_at: string;
};

export type SqlDetail = {
  sql_id: string;
  mql_id: string;
  estado: string;
  en_backlog: boolean;
  origen_creacion: 'enrutamiento_normal' | 'directo_comercial' | string;
  comercial_asignado_id: string | null;
  fecha_asignacion: string | null;
  fecha_creacion: string;
  ouv_id: string | null;
  ouv: { ouv_id: string; consecutivo: string } | null;
  lead: {
    lead_id?: string;
    empresa_nombre?: string;
    contacto_nombre?: string;
    email?: string;
    icp_score?: number | null;
    origen?: string;
    segment_id?: string | null;
    subsegment_id?: string | null;
    segmento?: string;
    [key: string]: unknown;
  };
  interactions: unknown[];
  cita: SqlCita | null;
};

export type PaginatedSqls = {
  items: SqlDetail[];
  total: number;
  page: number;
  limit: number;
};

export type AssignSqlPayload = {
  comercial_asignado_id: string;
  cita?: {
    lugar: string;
    fecha: string;
    hora: string;
    contacto_nombre: string;
    contacto_cargo?: string;
    descripcion?: string;
  };
};

export async function fetchSqlInbox(params: {
  page?: number;
  limit?: number;
}): Promise<PaginatedSqls> {
  return apiRequest(
    `/qualification/sqls/inbox${buildQueryString(params)}`,
  );
}

export async function fetchAssignedSqls(params: {
  page?: number;
  limit?: number;
}): Promise<PaginatedSqls> {
  return apiRequest(
    `/qualification/sqls/assigned${buildQueryString(params)}`,
  );
}

export async function fetchSql(sqlId: string): Promise<SqlDetail> {
  return apiRequest(`/qualification/sqls/${sqlId}`);
}

export async function assignSql(
  sqlId: string,
  payload: AssignSqlPayload,
): Promise<{ sql: SqlDetail; cita: SqlCita | null }> {
  return apiRequest(`/qualification/sqls/${sqlId}/assign`, {
    method: 'POST',
    body: payload,
  });
}

export async function updateSqlCita(
  sqlId: string,
  payload: Partial<AssignSqlPayload['cita']>,
): Promise<SqlCita> {
  return apiRequest(`/qualification/sqls/${sqlId}/cita`, {
    method: 'PATCH',
    body: payload,
  });
}

export type ConvertirSqlPayload = {
  titulo: string;
  descripcion?: string;
  segmento: 'Gobierno' | 'D&S' | 'ProyectosEspeciales' | 'B2B';
  segment_id: string;
  subsegment_id?: string | null;
  vertical: string;
};

export type ConvertirSqlResponse = {
  sql: SqlDetail;
  ouv: {
    ouv_id: string;
    consecutivo: string;
    titulo: string;
    segmento: string;
    vertical: string;
    zona_actual: string;
    resultado: string;
  };
};

export async function convertirSqlEnOuv(
  sqlId: string,
  payload: ConvertirSqlPayload,
): Promise<ConvertirSqlResponse> {
  return apiRequest(`/qualification/sqls/${sqlId}/convertir`, {
    method: 'POST',
    body: payload,
  });
}

export type CommercialOption = {
  user_id: string;
  full_name: string;
  email?: string;
};

export async function fetchCommercials(): Promise<CommercialOption[]> {
  return apiRequest('/leads/appointment-commercials');
}
