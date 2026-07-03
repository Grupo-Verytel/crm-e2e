import { apiRequest } from '../../../lib/api/http-client';
import { buildQueryString } from '../../../lib/format';
import type { MarketingDashboard } from '../types';

export async function fetchMarketingDashboard(
  query: { from?: string; to?: string } = {},
): Promise<MarketingDashboard> {
  return apiRequest<MarketingDashboard>(
    `/dashboard/marketing${buildQueryString(query)}`,
  );
}
