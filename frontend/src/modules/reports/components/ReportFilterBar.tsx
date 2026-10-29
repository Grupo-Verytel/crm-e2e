import { DatePickerField } from "../../../components/DatePickerField";
import { FiscalQuarterSelect } from "../../../components/FiscalQuarterSelect";
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "../../discovery/components/ui";
import { formatPeriodDate } from "../../discovery/lib/ouv-dashboard-format";
import type { ReportKind, ReportPageFilters } from "../lib/report-filters";

export function ReportFilterBar({
  report,
  draft,
  applied,
  years,
  comercialOptions,
  showComercial,
  segments,
  comercialName,
  onDraftChange,
  onApply,
  onClear,
}: {
  report: ReportKind;
  draft: ReportPageFilters;
  applied: ReportPageFilters;
  years: number[];
  comercialOptions: { value: string; label: string }[];
  showComercial: boolean;
  segments: readonly string[];
  comercialName: string | null;
  onDraftChange: (next: ReportPageFilters) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  return (
    <form
      className="mb-4"
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        {report === "committee" ? (
          <>
            <div className="w-28">
              <label className={labelClass} htmlFor="reports-year">
                Año
              </label>
              <select
                id="reports-year"
                className={inputClass}
                value={draft.year ?? ""}
                onChange={(event) => {
                  onDraftChange({
                    ...draft,
                    year: event.target.value ? Number(event.target.value) : null,
                    quarter: null,
                    periodFrom: "",
                    periodTo: "",
                  });
                }}
              >
                <option value="">—</option>
                {years.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-52">
              <label className={labelClass} htmlFor="reports-quarter">
                Trimestre
              </label>
              <FiscalQuarterSelect
                id="reports-quarter"
                className={`${inputClass} min-w-52 disabled:cursor-not-allowed disabled:opacity-50`}
                value={draft.quarter}
                disabled={draft.year == null}
                onChange={(value) => {
                  onDraftChange({
                    ...draft,
                    quarter: value ? Number(value) : null,
                    periodFrom: "",
                    periodTo: "",
                  });
                }}
              />
            </div>
            <div className="w-48">
              <label className={labelClass} htmlFor="reports-from">
                Desde
              </label>
              <DatePickerField
                id="reports-from"
                value={draft.periodFrom}
                aria-label="Desde"
                onChange={(value) => {
                  const periodFrom = value;
                  const clearQuarter = Boolean(periodFrom && draft.periodTo);
                  onDraftChange({
                    ...draft,
                    periodFrom,
                    year: clearQuarter ? null : draft.year,
                    quarter: clearQuarter ? null : draft.quarter,
                  });
                }}
              />
            </div>
            <div className="w-48">
              <label className={labelClass} htmlFor="reports-to">
                Hasta
              </label>
              <DatePickerField
                id="reports-to"
                value={draft.periodTo}
                aria-label="Hasta"
                align="end"
                onChange={(value) => {
                  const periodTo = value;
                  const clearQuarter = Boolean(draft.periodFrom && periodTo);
                  onDraftChange({
                    ...draft,
                    periodTo,
                    year: clearQuarter ? null : draft.year,
                    quarter: clearQuarter ? null : draft.quarter,
                  });
                }}
              />
            </div>
          </>
        ) : null}
        {showComercial ? (
          <div className="w-48">
            <label className={labelClass} htmlFor="reports-comercial">
              Comercial
            </label>
            <select
              id="reports-comercial"
              className={inputClass}
              value={draft.comercialId}
              onChange={(event) =>
                onDraftChange({ ...draft, comercialId: event.target.value })
              }
            >
              <option value="">Todos</option>
              {comercialOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="w-52">
          <label className={labelClass} htmlFor="reports-segmento">
            Segmento
          </label>
          <select
            id="reports-segmento"
            className={inputClass}
            value={draft.segmento}
            onChange={(event) =>
              onDraftChange({ ...draft, segmento: event.target.value })
            }
          >
            <option value="">Todos</option>
            {segments.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={`${primaryButtonClass} h-9`}>
          Aplicar
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted">{summary(report, applied, showComercial, comercialName)}</p>
        <button type="button" onClick={onClear} className={`${ghostButtonClass} h-9`}>
          Limpiar
        </button>
      </div>
    </form>
  );
}

function summary(
  report: ReportKind,
  applied: ReportPageFilters,
  showComercial: boolean,
  comercialName: string | null,
): string {
  const parts: string[] = [];
  if (report === "committee") {
    if (applied.periodFrom && applied.periodTo) {
      parts.push(
        `${formatPeriodDate(applied.periodFrom)} – ${formatPeriodDate(applied.periodTo)}`,
      );
    } else if (applied.year && applied.quarter) {
      parts.push(`Q${applied.quarter} ${applied.year}`);
    } else if (applied.year) {
      parts.push(`Año fiscal ${applied.year}`);
    } else {
      parts.push("Sin periodo");
    }
  }
  if (showComercial) {
    parts.push(comercialName ?? "Todos los comerciales");
  }
  parts.push(applied.segmento || "Todos los segmentos");
  return parts.join(" · ");
}
