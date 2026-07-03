import { apiRequest } from '../../../lib/api/http-client';
import { buildQueryString } from '../../../lib/format';
import type {
  Campaign,
  CampaignEstado,
  CampaignsQuery,
  CreateCampaignPayload,
  PaginatedCampaigns,
} from '../types';

export async function fetchCampaigns(
  query: CampaignsQuery = {},
): Promise<PaginatedCampaigns> {
  return apiRequest<PaginatedCampaigns>(`/campaigns${buildQueryString(query)}`);
}

export async function createCampaign(
  payload: CreateCampaignPayload,
): Promise<Campaign> {
  return apiRequest<Campaign>('/campaigns', { method: 'POST', body: payload });
}

export async function updateCampaignStatus(
  campanaId: string,
  estado: CampaignEstado,
): Promise<Campaign> {
  return apiRequest<Campaign>(`/campaigns/${campanaId}/status`, {
    method: 'PUT',
    body: { estado },
  });
}
