export type MarketingDashboardPeriodType =
  | 'annual'
  | 'quarter'
  | 'biweekly'
  | 'weekly';

export type MarketingDashboardTargetRow = {
  period_type: MarketingDashboardPeriodType;
  interactions: number;
  period_leads: number;
  converted_ouvs: number;
};

export type MarketingDashboardTargets = {
  targets: MarketingDashboardTargetRow[];
};

export const MARKETING_DASHBOARD_PERIOD_TYPES: MarketingDashboardPeriodType[] = [
  'annual',
  'quarter',
  'biweekly',
  'weekly',
];

export const MARKETING_DASHBOARD_PERIOD_LABELS: Record<
  MarketingDashboardPeriodType,
  string
> = {
  annual: 'Anual',
  quarter: 'Trimestral (Q)',
  biweekly: 'Quincenal',
  weekly: 'Semanal',
};

export const DEFAULT_MARKETING_DASHBOARD_TARGETS: MarketingDashboardTargetRow[] =
  MARKETING_DASHBOARD_PERIOD_TYPES.map((period_type) => ({
    period_type,
    interactions: 50,
    period_leads: 3,
    converted_ouvs: 3,
  }));

function daysInclusive(from: string, to: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return null;
  }
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  const start = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export function resolveActivePeriodType(input: {
  periodFrom: string;
  periodTo: string;
  periodRangeActive: boolean;
  accumulatedYear: number | null;
  quarter: number | null;
}): MarketingDashboardPeriodType {
  if (input.periodRangeActive) {
    const days = daysInclusive(input.periodFrom, input.periodTo);
    if (days != null && days <= 7) return 'weekly';
    if (days != null && days <= 15) return 'biweekly';
    return 'annual';
  }
  if (input.accumulatedYear != null && input.quarter != null) return 'quarter';
  if (input.accumulatedYear != null) return 'annual';
  return 'weekly';
}

export function resolveTargetsForPeriod(
  targets: MarketingDashboardTargetRow[],
  periodType: MarketingDashboardPeriodType,
): MarketingDashboardTargetRow {
  const found = targets.find((row) => row.period_type === periodType);
  return (
    found ??
    DEFAULT_MARKETING_DASHBOARD_TARGETS.find(
      (row) => row.period_type === periodType,
    ) ??
    DEFAULT_MARKETING_DASHBOARD_TARGETS[0]
  );
}

export function normalizeMarketingDashboardTargets(
  targets: MarketingDashboardTargetRow[] | undefined,
): MarketingDashboardTargetRow[] {
  const byType = new Map(
    (targets ?? []).map((row) => [row.period_type, row]),
  );
  return MARKETING_DASHBOARD_PERIOD_TYPES.map(
    (period_type) =>
      byType.get(period_type) ??
      DEFAULT_MARKETING_DASHBOARD_TARGETS.find(
        (row) => row.period_type === period_type,
      )!,
  );
}
