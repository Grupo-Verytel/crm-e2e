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
  comercial_asignado_id: string | null;
  fecha_asignacion: string | null;
  fecha_creacion: string;
  lead: {
    lead_id?: string;
    empresa_nombre?: string;
    contacto_nombre?: string;
    email?: string;
    icp_score?: number | null;
    origen?: string;
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

export type CommercialOption = {
  user_id: string;
  full_name: string;
  email?: string;
};

export async function fetchCommercials(): Promise<CommercialOption[]> {
  return apiRequest('/leads/appointment-commercials');
}
