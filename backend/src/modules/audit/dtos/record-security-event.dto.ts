import { AuditAction } from '../models/audit-action.enum';

export class RecordSecurityEventDto {
  accion: AuditAction.LOGIN | AuditAction.EXPORT | AuditAction.STATE_CHANGE;
  tabla: string;
  registro_id: string;
  campo_modificado?: string;
  valor_anterior?: string;
  valor_nuevo?: string;
  contexto?: Record<string, unknown>;
}
