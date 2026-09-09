import { apiRequest } from '../../../lib/api/http-client';
import type { CommercialOption } from '../types';

/**
 * Active TraductorDeNegocio users for business_referrer_id select.
 * Uses a Lead-readable endpoint (not GET /users, which is Admin-only).
 */
export async function fetchTraductorReferrers(): Promise<CommercialOption[]> {
  return apiRequest<CommercialOption[]>('/leads/traductor-referrers');
}
