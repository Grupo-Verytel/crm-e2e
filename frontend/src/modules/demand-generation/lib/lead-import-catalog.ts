import { fetchAccounts } from '../../accounts/api/accounts-api';
import { fetchCampaigns } from '../api/campaigns-api';
import { fetchSegments } from '../api/segments-api';
import { fetchTraductorReferrers } from '../api/traductores-api';
import type { LeadImportLists } from './lead-bulk-import';

async function fetchAccountLabels(): Promise<string[]> {
  const labels: string[] = [];
  let page = 1;
  const limit = 100;

  for (;;) {
    const data = await fetchAccounts({ page, limit });
    for (const account of data.items) {
      labels.push(
        account.tax_id ? `${account.name} (${account.tax_id})` : account.name,
      );
    }
    if (data.items.length === 0 || page * limit >= data.total) {
      break;
    }
    page += 1;
  }

  return labels;
}

export async function loadLeadImportCatalog(): Promise<LeadImportLists> {
  const [segments, traductores, campaignsPage, empresas] = await Promise.all([
    fetchSegments().catch(() => []),
    fetchTraductorReferrers().catch(() => []),
    fetchCampaigns({ estado: 'Activa', limit: 100 }).catch(() => ({
      items: [],
      total: 0,
      page: 1,
      limit: 100,
    })),
    fetchAccountLabels().catch(() => []),
  ]);

  return {
    subsegmentos: segments.flatMap((segment) =>
      segment.subsegments.map((subsegment) => subsegment.name),
    ),
    traductores: traductores.map((item) => item.email),
    campanas: campaignsPage.items.map((item) => item.nombre),
    empresas,
  };
}
