import { apiRequest } from '../../../lib/api/http-client';
import { buildQueryString } from '../../../lib/format';
import type {
  AuditActorOption,
  AuditLogQuery,
  PaginatedAuditLog,
} from '../types';

type PaginatedUsers = {
  items: AuditActorOption[];
  total: number;
  page: number;
  limit: number;
};

export async function fetchAuditLog(
  query: AuditLogQuery = {},
): Promise<PaginatedAuditLog> {
  return apiRequest<PaginatedAuditLog>(`/audit-log${buildQueryString(query)}`);
}

export async function fetchAuditActors(): Promise<AuditActorOption[]> {
  const first = await apiRequest<PaginatedUsers>(
    `/users${buildQueryString({ page: 1, limit: 100 })}`,
  );
  const actors = [...first.items];
  const totalPages = Math.max(1, Math.ceil(first.total / first.limit));

  for (let page = 2; page <= totalPages; page += 1) {
    const next = await apiRequest<PaginatedUsers>(
      `/users${buildQueryString({ page, limit: 100 })}`,
    );
    actors.push(...next.items);
  }

  return actors.sort((a, b) =>
    a.full_name.localeCompare(b.full_name, 'es', { sensitivity: 'base' }),
  );
}
