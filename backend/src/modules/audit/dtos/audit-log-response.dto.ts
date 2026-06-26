import { AuditAction } from '../models/audit-action.enum';

export class AuditLogResponseDto {
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
  timestamp: Date;
  contexto: Record<string, unknown> | null;
}

export class PaginatedAuditLogResponseDto {
  items: AuditLogResponseDto[];
  total: number;
  page: number;
  limit: number;
}
