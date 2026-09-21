import { apiRequest } from '../../../lib/api/http-client';
import { buildQueryString } from '../../../lib/format';
import type { MarketingDashboardTargets } from '../lib/marketing-dashboard-targets';
import type {
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

export async function fetchMarketingDashboardTargets(): Promise<MarketingDashboardTargets> {
  return apiRequest<MarketingDashboardTargets>('/dashboard/marketing/targets');
}

export async function updateMarketingDashboardTargets(
  targets: MarketingDashboardTargets['targets'],
): Promise<MarketingDashboardTargets> {
  return apiRequest<MarketingDashboardTargets>('/dashboard/marketing/targets', {
    method: 'PUT',
    body: JSON.stringify({ targets }),
  });
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
