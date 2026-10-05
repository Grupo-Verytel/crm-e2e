import { apiRequest } from '../../../lib/api/http-client';
import { buildQueryString } from '../../../lib/format';

export type QualificationOuvValueMetric = {
  amount: number;
  count: number;
};

export type QualificationDashboard = {
  period: {
    active: boolean;
    period_from: string | null;
    period_to: string | null;
    year: number | null;
    quarter: number | null;
  };
  mql_bandeja: {
    pending_total: number;
    without_cita: number;
    with_cita: number;
  };
  citas_calificacion: {
    scheduled_by_commercial: number;
    executed: number;
    sql_assigned_in_period: number;
    sql_converted_to_ouv_in_period: number;
    sql_to_ouv_conversion_rate: number | null;
  };
  pipeline: {
    open_zonas: {
      universo: QualificationOuvValueMetric;
      encima_funnel: QualificationOuvValueMetric;
      en_funnel: QualificationOuvValueMetric;
      mayor_probabilidad: QualificationOuvValueMetric;
    };
    ouvs_won_in_period: QualificationOuvValueMetric;
    ouvs_lost_in_period: QualificationOuvValueMetric;
    ouvs_discarded_in_period: QualificationOuvValueMetric;
  };
};

export async function fetchQualificationDashboard(
  query: {
    year?: number;
    quarter?: number;
    period_from?: string;
    period_to?: string;
  } = {},
): Promise<QualificationDashboard> {
  return apiRequest<QualificationDashboard>(
    `/qualification/dashboard${buildQueryString(query)}`,
  );
}

export const QUALIFICATION_DASHBOARD_DETAIL_KINDS = [
  'mql_bandeja',
  'mql_with_cita',
  'citas_scheduled',
  'citas_executed',
  'sql_converted_ouv',
  'ouvs_universo',
  'ouvs_encima_funnel',
  'ouvs_en_funnel',
  'ouvs_mayor_probabilidad',
  'ouvs_won',
  'ouvs_lost',
  'ouvs_discarded',
] as const;

export type QualificationDashboardDetailKind =
  (typeof QUALIFICATION_DASHBOARD_DETAIL_KINDS)[number];

export type QualificationOuvAmountKind =
  | 'Presupuestado'
  | 'Ganado'
  | 'Perdido'
  | 'Descartado';

export type QualificationDashboardDetailItem = {
  entity: 'lead' | 'sql' | 'ouv' | 'cita';
  id: string;
  label: string;
  segmento: string | null;
  estado: string | null;
  detail: string | null;
  occurred_at: string | null;
  sql_id: string | null;
  amount: string | null;
  amount_kind: QualificationOuvAmountKind | null;
};

export type QualificationDashboardDetails = {
  kind: QualificationDashboardDetailKind;
  items: QualificationDashboardDetailItem[];
  total: number;
  page: number;
  limit: number;
};

export async function fetchQualificationDashboardDetails(query: {
  kind: QualificationDashboardDetailKind;
  quarter?: number;
  period_from?: string;
  period_to?: string;
  year?: number;
  page?: number;
  limit?: number;
}): Promise<QualificationDashboardDetails> {
  return apiRequest<QualificationDashboardDetails>(
    `/qualification/dashboard/details${buildQueryString(query)}`,
  );
}
