import { apiRequest } from '../../../lib/api/http-client';
import { buildQueryString } from '../../../lib/format';

export type OuvDashboardZone =
  | 'UNIVERSO'
  | 'ENCIMA_FUNNEL'
  | 'EN_FUNNEL'
  | 'MAYOR_PROBABILIDAD';

export type OuvDashboard = {
  period: {
    active: boolean;
    period_from: string | null;
    period_to: string | null;
    year: number | null;
    quarter: number | null;
    compare_from: string | null;
    compare_to: string | null;
  };
  pipeline_weighted: {
    amount: number;
    open_amount: number;
    weight_share: number | null;
    weights: { zona: OuvDashboardZone; label: string; weight: number }[];
  };
  pipeline_value: {
    amount: number;
    count: number;
    delta_ratio: number | null;
  };
  close_rate: {
    rate: number | null;
    delta_points: number | null;
    won_count: number;
    lost_count: number;
  };
  sales_cycle: {
    avg_days: number | null;
    by_segment: { segmento: string; avg_days: number; count: number }[];
  };
  new_ouvs: { count: number; amount: number };
  funnel: {
    zona: OuvDashboardZone;
    label: string;
    amount: number;
    count: number;
    conversion_to_next: number | null;
    next_label: string;
  }[];
  bottleneck: {
    from_label: string;
    to_label: string;
    rate: number;
  } | null;
  won_vs_lost: {
    won: { count: number; amount: number };
    lost: { count: number; amount: number };
    loss_reasons: { label: string; count: number; share: number }[];
  };
  pipeline_by_sector: {
    segmento: string;
    amount: number;
    share: number;
    win_rate: number | null;
  }[];
  new_origins: { label: string; count: number }[];
  executives: {
    user_id: string;
    full_name: string;
    open_count: number;
    pipeline_amount: number;
    win_rate: number | null;
    won_amount: number;
  }[];
  stalled: {
    ouv_id: string;
    consecutivo: string;
    titulo: string;
    zona: string;
    amount: number;
    days_stale: number;
    comercial_name: string;
  }[];
};

export type OuvDashboardQuery = {
  year?: number;
  quarter?: number;
  period_from?: string;
  period_to?: string;
  comercial_id?: string;
  segmento?: string;
};

export function fetchOuvDashboard(
  query: OuvDashboardQuery,
): Promise<OuvDashboard> {
  return apiRequest<OuvDashboard>(
    `/discovery/ouv-dashboard${buildQueryString(query)}`,
  );
}
