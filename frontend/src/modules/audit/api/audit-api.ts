import { apiRequest } from '../../../lib/api/http-client';
import { buildQueryString } from '../../../lib/format';
import type { AuditLogQuery, PaginatedAuditLog } from '../types';

export async function fetchAuditLog(
  query: AuditLogQuery = {},
): Promise<PaginatedAuditLog> {
  return apiRequest<PaginatedAuditLog>(`/audit-log${buildQueryString(query)}`);
}
