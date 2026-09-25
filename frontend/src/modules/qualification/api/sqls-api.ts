import { apiRequest } from '../../../lib/api/http-client';
import { buildQueryString } from '../../../lib/format';
import type { SqlAppointmentEvent } from '../types/sql-appointment-event.types';

export type SqlCita = {
  cita_id: string;
  sql_id: string;
  lugar: string;
  fecha: string;
  hora: string;
  contacto_nombre: string;
  contacto_email: string | null;
  contacto_telefono: string | null;
  contactos?: Array<{
    nombre: string;
    email: string;
    telefono: string;
  }>;
  contacto_cargo: string | null;
  descripcion: string | null;
  agendada_por: string;
  estado?: string;
  graph_event_id?: string | null;
  graph_organizer_upn?: string | null;
  teams_join_url?: string | null;
  duration_minutes?: number;
  /** Computed by the API in America/Bogota. Do not recompute on the client. */
  vigente?: boolean;
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
    name?: string | null;
    empresa_nombre?: string;
    contacto_nombre?: string;
    email?: string;
    icp_score?: number | null;
    origen?: string;
    canal_origen?: string;
    cita_agendada?: boolean;
    fecha_cita?: string | null;
    cita_lugar?: string | null;
    cita_contacto_nombre?: string | null;
    cita_contacto_email?: string | null;
    cita_contacto_telefono?: string | null;
    cita_contactos?: Array<{
      nombre: string;
      email: string;
      telefono: string;
    }> | null;
    comercial_asignado_id?: string | null;
    segment_id?: string | null;
    subsegment_id?: string | null;
    segmento?: string;
    city?: string | null;
    region?: string | null;
    [key: string]: unknown;
  };
  interactions: unknown[];
  interactions_count?: number;
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
    contacto_email?: string;
    contacto_telefono?: string;
    contactos?: Array<{
      nombre: string;
      email: string;
      telefono: string;
    }>;
    contacto_cargo?: string;
    descripcion?: string;
    duration_minutes?: number;
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

export async function createAssignedSqlCita(
  sqlId: string,
  payload: NonNullable<AssignSqlPayload['cita']>,
): Promise<SqlCita> {
  return apiRequest(`/qualification/sqls/${sqlId}/cita`, {
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

export async function fetchSqlAppointmentEvents(
  sqlId: string,
): Promise<SqlAppointmentEvent[]> {
  return apiRequest(`/qualification/sqls/${sqlId}/cita/events`);
}

export async function closeSqlCita(
  sqlId: string,
  resultado: 'Realizada' | 'NoAsistio',
): Promise<SqlCita> {
  return apiRequest(`/qualification/sqls/${sqlId}/cita/outcome`, {
    method: 'POST',
    body: { resultado },
  });
}

export async function cancelSqlCita(sqlId: string): Promise<void> {
  await apiRequest<void>(`/qualification/sqls/${sqlId}/cita`, {
    method: 'DELETE',
  });
}

export type ConvertirSqlPayload = {
  titulo: string;
  descripcion?: string;
  segmento:
    | 'Ciudades y gobernaciones'
    | 'Gobierno central'
    | 'Defensa y seguridad'
    | 'Industria'
    | 'Gobierno'
    | 'D&S'
    | 'ProyectosEspeciales'
    | 'B2B'
    | string;
  segment_id: string;
  subsegment_id?: string | null;
  vertical: string;
  city?: string;
  region?: string;
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
