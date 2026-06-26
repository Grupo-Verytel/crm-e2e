import { AuditAction } from '../models/audit-action.enum';

export interface AuditWriteEntry {
  tabla: string;
  registroId: string;
  accion: AuditAction;
  campoModificado?: string | null;
  valorAnterior?: string | null;
  valorNuevo?: string | null;
  contexto?: Record<string, unknown> | null;
}
