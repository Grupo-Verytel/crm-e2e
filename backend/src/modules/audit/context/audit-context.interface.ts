export interface AuditRequestContext {
  usuarioId: string;
  ipAddress: string;
  userAgent: string | null;
}
