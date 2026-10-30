import { apiRequest } from "../../../lib/api/http-client";
import { buildQueryString } from "../../../lib/format";

export type CommercialReportKind =
  | "m003_new"
  | "m003_zone_changes"
  | "m003_amount_changes"
  | "m003_won"
  | "m003_lost"
  | "m003_mobilized"
  | "m035_advances"
  | "m035_retreats"
  | "m035_closures"
  | "m035_reopenings"
  | "m025_new"
  | "m013_expected_close"
  | "m013_created_in_period"
  | "m013_missing_close"
  | "m023_1_2"
  | "m023_2_3"
  | "m023_over_3"
  | "m023_aged"
  | "open_average_age";

export type MobilizationBlock = {
  ouv_count: number;
  event_count: number;
  amount: number;
};

export type StageCell = {
  from_estado: string | null;
  to_estado: string;
  event_count: number;
  event_amount: number;
  ouv_count: number;
  ouv_amount: number;
};

export type StageBlock = {
  event_count: number;
  event_amount: number;
  ouv_count: number;
  ouv_amount: number;
  cells: StageCell[];
};

export type CountAmount = { count: number; amount: number };

export type CommitteeReport = {
  period: {
    period_from: string | null;
    period_to: string | null;
    year: number | null;
    quarter: number | null;
  };
  fecha_corte: string;
  as_of: string;
  excluded_synthetic: number;
  m003: {
    mobilized: MobilizationBlock;
    new_ouvs: MobilizationBlock;
    zone_changes: MobilizationBlock;
    amount_changes: MobilizationBlock;
    won: MobilizationBlock;
    lost: MobilizationBlock;
  };
  m035: {
    advances: StageBlock;
    retreats: StageBlock;
    closures: StageBlock;
    reopenings: StageBlock;
  };
  m025: {
    by_segment: { segmento: string; count: number; amount: number }[];
    by_commercial: {
      user_id: string;
      full_name: string;
      count: number;
      amount: number;
    }[];
  };
  m013: {
    by_resultado: {
      resultado: string;
      count: number;
      amount: number;
      created_in_period: number;
      created_in_period_amount: number;
    }[];
    created_in_period: CountAmount;
    missing_expected_close: CountAmount;
  };
};

export type AgeRangeId = "1_2" | "2_3" | "over_3";

export type PipelineHealthReport = {
  as_of: string;
  m023: {
    ranges: {
      range: AgeRangeId;
      label: string;
      count: number;
      amount: number;
    }[];
    by_segment: {
      segmento: string;
      ranges: { range: AgeRangeId; count: number; amount: number }[];
    }[];
    by_commercial: {
      user_id: string;
      full_name: string;
      ranges: { range: AgeRangeId; count: number; amount: number }[];
    }[];
  };
  average_age: {
    by_segment: {
      segmento: string;
      count: number;
      amount: number;
      avg_days: number;
    }[];
  };
};

export type CommercialReportDetailItem = {
  ouv_id: string;
  consecutivo: string;
  titulo: string;
  empresa: string;
  comercial: string;
  segmento: string;
  zona: string;
  monto: number | null;
  fecha: string | null;
  from_estado: string | null;
  to_estado: string | null;
  changed_at: string | null;
  changed_by: string | null;
  previous_amount: number | null;
  new_amount: number | null;
  campo: string | null;
};

export type CommercialReportDetailPage = {
  kind: CommercialReportKind;
  items: CommercialReportDetailItem[];
  total: number;
  amount_total: number;
  ouv_count: number;
  ouv_amount: number;
  page: number;
  limit: number;
};

export type CommercialReportQuery = {
  year?: number;
  quarter?: number;
  period_from?: string;
  period_to?: string;
  fecha_corte?: string;
  comercial_id?: string;
  segmento?: string;
};

export type CommercialReportDetailOpen = {
  report: "committee" | "pipeline-health";
  kind: CommercialReportKind;
  title: string;
  from_estado?: string;
  to_estado?: string;
  resultado?: string;
  comercial_id?: string;
  segmento?: string;
};

export function fetchCommitteeReport(
  query: CommercialReportQuery,
): Promise<CommitteeReport> {
  return apiRequest<CommitteeReport>(
    `/discovery/reports/committee${buildQueryString(query)}`,
  );
}

export function fetchPipelineHealth(
  query: Pick<CommercialReportQuery, "comercial_id" | "segmento">,
): Promise<PipelineHealthReport> {
  return apiRequest<PipelineHealthReport>(
    `/discovery/reports/pipeline-health${buildQueryString(query)}`,
  );
}

export function fetchCommercialReportDetails(
  query: CommercialReportQuery & {
    report: "committee" | "pipeline-health";
    kind: CommercialReportKind;
    from_estado?: string;
    to_estado?: string;
    resultado?: string;
    page: number;
    limit: number;
  },
): Promise<CommercialReportDetailPage> {
  return apiRequest<CommercialReportDetailPage>(
    `/discovery/reports/details${buildQueryString(query)}`,
  );
}
