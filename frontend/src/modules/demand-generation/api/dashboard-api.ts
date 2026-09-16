import { apiRequest } from '../../../lib/api/http-client';
import { buildQueryString } from '../../../lib/format';
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
  page?: number;
  limit?: number;
}): Promise<MarketingDashboardDetails> {
  return apiRequest<MarketingDashboardDetails>(
    `/dashboard/marketing/details${buildQueryString(query)}`,
  );
}
