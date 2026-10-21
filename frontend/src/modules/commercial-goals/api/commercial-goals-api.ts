import { apiRequest } from '../../../lib/api/http-client';
import { buildQueryString } from '../../../lib/format';
import type {
  CommercialGoal,
  CommercialGoalSummary,
  CommercialGoalWrite,
  GoalListQuery,
  PaginatedCommercialGoals,
} from '../types';

export async function fetchCommercialGoals(
  query: GoalListQuery,
): Promise<PaginatedCommercialGoals> {
  return apiRequest<PaginatedCommercialGoals>(
    `/commercial-goals${buildQueryString(query)}`,
  );
}

export async function fetchCommercialGoalSummary(query: {
  fiscal_year: number;
  user_id?: string;
  segment_id?: string;
}): Promise<CommercialGoalSummary> {
  return apiRequest<CommercialGoalSummary>(
    `/commercial-goals/summary${buildQueryString(query)}`,
  );
}

export async function fetchCommercialGoal(id: string): Promise<CommercialGoal> {
  return apiRequest<CommercialGoal>(`/commercial-goals/${id}`);
}

export async function createCommercialGoal(
  body: CommercialGoalWrite,
): Promise<CommercialGoal> {
  return apiRequest<CommercialGoal>('/commercial-goals', {
    method: 'POST',
    body,
  });
}

export async function updateCommercialGoal(
  id: string,
  body: Partial<CommercialGoalWrite>,
): Promise<CommercialGoal> {
  return apiRequest<CommercialGoal>(`/commercial-goals/${id}`, {
    method: 'PATCH',
    body,
  });
}

export async function deleteCommercialGoal(id: string): Promise<void> {
  await apiRequest(`/commercial-goals/${id}`, { method: 'DELETE' });
}
