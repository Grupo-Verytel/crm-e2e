import { apiRequest } from '../../../lib/api/http-client';
import { buildQueryString } from '../../../lib/format';
import type {
  ApproveAgencyMqlPayload,
  Mql,
  MqlsQuery,
  PaginatedMqls,
} from '../types';

export async function fetchMqls(query: MqlsQuery = {}): Promise<PaginatedMqls> {
  return apiRequest<PaginatedMqls>(`/mqls${buildQueryString(query)}`);
}

export async function approveMql(
  mqlId: string,
  payload?: ApproveAgencyMqlPayload & { comentario?: string },
): Promise<unknown> {
  return apiRequest(`/mqls/${mqlId}/approve`, {
    method: 'POST',
    body: payload ?? {},
  });
}

export async function rejectMql(mqlId: string, motivo: string): Promise<Mql> {
  return apiRequest<Mql>(`/mqls/${mqlId}/reject`, {
    method: 'POST',
    body: { motivo },
  });
}
