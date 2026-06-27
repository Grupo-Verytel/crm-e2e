export type AuditAction =
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | 'STATE_CHANGE'
  | 'LOGIN'
  | 'EXPORT';

export type AuditLogEntry = {
  audit_id: string;
  tabla: string;
  registro_id: string;
  accion: AuditAction;
  campo_modificado: string | null;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  usuario_id: string;
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
  page?: number;
  limit?: number;
};

export const AUDIT_ACTIONS: AuditAction[] = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'STATE_CHANGE',
  'LOGIN',
  'EXPORT',
];
