import { apiRequest } from '../../../lib/api/http-client';
import { buildQueryString } from '../../../lib/format';
import type {
  DemandGoalMetric,
  DemandGoalsList,
  DemandGoalsReplaceResult,
  MarketingDashboard,
  MarketingDashboardDetailKind,
  MarketingDashboardDetails,
} from '../types';

export async function fetchMarketingDashboard(
  query: {
    from?: string;
    to?: string;
    quarter?: number;
    period_from?: string;
    period_to?: string;
    year?: number;
  } = {},
): Promise<MarketingDashboard> {
  return apiRequest<MarketingDashboard>(
    `/dashboard/marketing${buildQueryString(query)}`,
  );
}

export async function fetchMarketingDashboardDetails(query: {
  kind: MarketingDashboardDetailKind;
  estado?: string;
  quarter?: number;
  period_from?: string;
  period_to?: string;
  year?: number;
  page?: number;
  limit?: number;
}): Promise<MarketingDashboardDetails> {
  return apiRequest<MarketingDashboardDetails>(
    `/dashboard/marketing/details${buildQueryString(query)}`,
  );
}

export async function fetchMarketingDashboardGoals(
  year: number,
): Promise<DemandGoalsList> {
  return apiRequest<DemandGoalsList>(
    `/dashboard/marketing/goals${buildQueryString({ year })}`,
  );
}

export async function replaceMarketingDashboardGoals(body: {
  fiscal_year: number;
  quarter: number;
  goals: { metric: DemandGoalMetric; weekly_target: number }[];
}): Promise<DemandGoalsReplaceResult> {
  return apiRequest<DemandGoalsReplaceResult>('/dashboard/marketing/goals', {
    method: 'PUT',
    body,
  });
}

export async function deleteMarketingDashboardGoal(
  targetId: string,
): Promise<{ deleted: true }> {
  return apiRequest<{ deleted: true }>(
    `/dashboard/marketing/goals/${targetId}`,
    { method: 'DELETE' },
  );
}
