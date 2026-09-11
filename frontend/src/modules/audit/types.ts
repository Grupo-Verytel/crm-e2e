export type AuditAction =
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | 'STATE_CHANGE'
  | 'LOGIN'
  | 'EXPORT';

export type AuditSortField =
  | 'timestamp'
  | 'accion'
  | 'tabla'
  | 'registro_id'
  | 'campo_modificado'
  | 'actor'
  | 'ip_address';

export type AuditSortDirection = 'ASC' | 'DESC';

export type AuditLogEntry = {
  audit_id: string;
  tabla: string;
  registro_id: string;
  accion: AuditAction;
  campo_modificado: string | null;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  usuario_id: string;
  actor_nombre: string | null;
  ip_address: string;
  user_agent: string | null;
  timestamp: string;
  contexto: Record<string, unknown> | null;
};

export type PaginatedAuditLog = {
  items: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
};

export type AuditLogQuery = {
  tabla?: string;
  registro_id?: string;
  usuario_id?: string;
  accion?: AuditAction;
  from?: string;
  to?: string;
  sort_by?: AuditSortField;
  sort_dir?: AuditSortDirection;
  page?: number;
  limit?: number;
};

export type AuditActorOption = {
  user_id: string;
  full_name: string;
  email: string;
};

export const AUDIT_ACTIONS: AuditAction[] = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'STATE_CHANGE',
  'LOGIN',
  'EXPORT',
];
