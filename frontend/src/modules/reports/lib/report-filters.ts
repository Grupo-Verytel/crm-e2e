import { verytelQuarterOf } from "../../commercial-goals/lib/verytel-quarter";

export type ReportKind = "committee" | "pipeline-health";

export type ReportPageFilters = {
  year: number | null;
  quarter: number | null;
  periodFrom: string;
  periodTo: string;
  comercialId: string;
  segmento: string;
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const COMMITTEE_KEYS = [
  "year",
  "quarter",
  "period_from",
  "period_to",
  "comercial_id",
  "segmento",
] as const;

const HEALTH_KEYS = ["comercial_id", "segmento"] as const;

export function bogotaToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addCalendarDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const nextYear = utc.getUTCFullYear();
  const nextMonth = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(utc.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function defaultCorte(now = new Date()): string {
  return addCalendarDays(bogotaToday(now), -7);
}

export function corteDaysAgo(days: number, now = new Date()): string {
  return addCalendarDays(bogotaToday(now), -days);
}

/** `21-oct-2026`, for badges and empty states. */
export function formatDayTag(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  if (!year || !month || !day) return ymd;
  return `${day}-${MONTHS[month - 1]}-${year}`;
}

export function defaultPageFilters(now = new Date()): ReportPageFilters {
  const today = verytelQuarterOf(now);
  return {
    year: today.fiscalYear,
    quarter: today.quarter,
    periodFrom: "",
    periodTo: "",
    comercialId: "",
    segmento: "",
  };
}

function parseYear(value: string | null): number | null {
  if (!value || !/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  if (year < 2000 || year > 2100) return null;
  return year;
}

function parseQuarter(value: string | null): number | null {
  if (!value || !/^[1-4]$/.test(value)) return null;
  return Number(value);
}

export function filtersFromSearch(
  params: URLSearchParams,
  report: ReportKind,
  now = new Date(),
): ReportPageFilters {
  const defaults = defaultPageFilters(now);
  const comercialId = params.get("comercial_id") ?? "";
  const segmento = params.get("segmento") ?? "";
  if (report === "pipeline-health") {
    return {
      year: null,
      quarter: null,
      periodFrom: "",
      periodTo: "",
      comercialId,
      segmento,
    };
  }
  const periodFrom = params.get("period_from") ?? "";
  const periodTo = params.get("period_to") ?? "";
  if (YMD.test(periodFrom) && YMD.test(periodTo)) {
    return {
      year: null,
      quarter: null,
      periodFrom,
      periodTo,
      comercialId,
      segmento,
    };
  }
  if (!params.get("year") && !params.get("quarter")) {
    return { ...defaults, comercialId, segmento };
  }
  const year = parseYear(params.get("year"));
  return {
    year,
    quarter: year == null ? null : parseQuarter(params.get("quarter")),
    periodFrom: "",
    periodTo: "",
    comercialId,
    segmento,
  };
}

export function fechaCorteFromSearch(
  params: URLSearchParams,
  now = new Date(),
): string {
  const value = params.get("fecha_corte") ?? "";
  return YMD.test(value) ? value : defaultCorte(now);
}

/** Page-bar params only. Fecha de corte stays out so editing it does not reset the draft. */
export function filterSearchKey(
  params: URLSearchParams,
  report: ReportKind,
): string {
  const next = new URLSearchParams();
  const keys = report === "pipeline-health" ? HEALTH_KEYS : COMMITTEE_KEYS;
  for (const key of keys) {
    const value = params.get(key);
    if (value) next.set(key, value);
  }
  return next.toString();
}

export function serializeFilters(
  filters: ReportPageFilters,
  report: ReportKind,
  fechaCorte: string,
  now = new Date(),
): URLSearchParams {
  const next = new URLSearchParams();
  if (report === "committee") {
    if (YMD.test(filters.periodFrom) && YMD.test(filters.periodTo)) {
      next.set("period_from", filters.periodFrom);
      next.set("period_to", filters.periodTo);
    } else if (filters.year != null) {
      next.set("year", String(filters.year));
      if (filters.quarter != null) next.set("quarter", String(filters.quarter));
    }
    if (fechaCorte && fechaCorte !== defaultCorte(now)) {
      next.set("fecha_corte", fechaCorte);
    }
  }
  if (filters.comercialId) next.set("comercial_id", filters.comercialId);
  if (filters.segmento) next.set("segmento", filters.segmento);
  return next;
}

export function periodBasisLabel(period: {
  year: number | null;
  quarter: number | null;
  period_from: string | null;
  period_to: string | null;
}): string {
  if (period.quarter && period.year) return `Q${period.quarter} ${period.year}`;
  if (period.period_from && period.period_to) {
    return `${formatDayTag(period.period_from)} – ${formatDayTag(period.period_to)}`;
  }
  if (period.year) return String(period.year);
  return "Periodo";
}

export function corteBasisLabel(fechaCorte: string): string {
  return `Desde ${formatDayTag(fechaCorte)}`;
}
