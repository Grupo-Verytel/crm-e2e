import { apiRequest } from '../../../lib/api/http-client';
import { buildQueryString } from '../../../lib/format';
import type {
  AssignedOuvItem,
  FollowUpStatus,
} from '../types/assigned-ouvs.types';

export type AssignedOuvsQuery = {
  page?: number;
  limit?: number;
  comercial_id?: string;
  follow_up_status?: FollowUpStatus[];
  search?: string;
};

export type PaginatedAssignedOuvs = {
  items: AssignedOuvItem[];
  total: number;
  page: number;
  limit: number;
};

export async function fetchAssignedOuvs(
  params: AssignedOuvsQuery,
): Promise<PaginatedAssignedOuvs> {
  const query = buildQueryString({
    page: params.page,
    limit: params.limit,
    comercial_id: params.comercial_id,
    follow_up_status: params.follow_up_status?.length
      ? params.follow_up_status.join(',')
      : undefined,
    search: params.search,
  });
  return apiRequest(`/qualification/assigned-ouvs${query}`);
}
