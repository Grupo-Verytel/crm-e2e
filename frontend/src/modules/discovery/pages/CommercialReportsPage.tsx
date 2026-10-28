import { useCallback, useEffect, useMemo, useState } from "react";
import { DatePickerField } from "../../../components/DatePickerField";
import { FiscalQuarterSelect } from "../../../components/FiscalQuarterSelect";
import { Pagination } from "../../../components/Pagination";
import { AppLayout } from "../../../layout/AppLayout";
import { formatDateTime } from "../../../lib/format";
import { verytelQuarterOf } from "../../commercial-goals/lib/verytel-quarter";
import { ModalShell } from "../../demand-generation/components/ModalShell";
import { ApiError } from "../../auth/types";
import { useAuth } from "../../auth/hooks/useAuth";
import {
  fetchCommercialReportDetails,
  fetchCommitteeReport,
  fetchPipelineHealth,
  type CommercialReportDetailItem,
  type CommercialReportDetailOpen,
  type CommercialReportQuery,
  type CommitteeReport,
  type PipelineHealthReport,
} from "../api/commercial-reports-api";
import {
  commercialOptionLabel,
  fetchEjecutivosComerciales,
  type EjecutivoComercialOption,
} from "../api/catalogos-api";
import {
  CommitteePanels,
  PipelineHealthPanels,
} from "../components/CommercialReportsPanels";
import { ghostButtonClass, inputClass, labelClass } from "../components/ui";
import { hasCommercialReportPermission } from "../lib/can-read-commercial-report";
import { canReadAllOuvs } from "../lib/ouv-access";
import { formatCompactMoney } from "../lib/ouv-dashboard-format";
import { OUV_ZONA_LABEL, type OuvZona, SEGMENTOS } from "../lib/ouv-vocab";

const DETAIL_PAGE_SIZE = 20;

function bogotaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addCalendarDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const nextYear = utc.getUTCFullYear();
  const nextMonth = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(utc.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function yearOptions(fiscalYear: number): number[] {
  const currentYear = new Date().getFullYear();
  return [
    ...new Set([fiscalYear, currentYear, currentYear - 1, currentYear - 2]),
  ].sort((left, right) => right - left);
}

function estadoLabel(value: string | null): string {
  if (!value) return "—";
  if (value in OUV_ZONA_LABEL) return OUV_ZONA_LABEL[value as OuvZona];
  return value;
}

function formatMoney(value: number | null): string {
  if (value == null) return "—";
  return formatCompactMoney(value);
}

const tabIdle =
  "-mb-px border-b-2 border-transparent px-4 py-2 text-sm text-muted hover:text-accent";
const tabActive =
  "-mb-px border-b-2 border-accent px-4 py-2 text-sm font-bold text-accent";

export function CommercialReportsPage() {
  const { user } = useAuth();
  const allowed = hasCommercialReportPermission(user);
  const showEjecutivo = canReadAllOuvs(user?.role_name);
  const today = useMemo(() => verytelQuarterOf(new Date()), []);
  const years = useMemo(
    () => yearOptions(today.fiscalYear),
    [today.fiscalYear],
  );
  const [tab, setTab] = useState<"committee" | "health">("committee");
  const [year, setYear] = useState<number | null>(today.fiscalYear);
  const [quarter, setQuarter] = useState<number | null>(today.quarter);
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [fechaCorte, setFechaCorte] = useState(() =>
    addCalendarDays(bogotaToday(), -7),
  );
  const [comercialId, setComercialId] = useState("");
  const [segmento, setSegmento] = useState("");
  const [ejecutivos, setEjecutivos] = useState<EjecutivoComercialOption[]>([]);
  const [committee, setCommittee] = useState<CommitteeReport | null>(null);
  const [health, setHealth] = useState<PipelineHealthReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<CommercialReportDetailOpen | null>(null);
  const [detailPage, setDetailPage] = useState(1);
  const [detailItems, setDetailItems] = useState<CommercialReportDetailItem[]>(
    [],
  );
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailAmount, setDetailAmount] = useState(0);
  const [detailOuvCount, setDetailOuvCount] = useState(0);
  const [detailOuvAmount, setDetailOuvAmount] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const periodRangeActive = Boolean(periodFrom && periodTo);

  useEffect(() => {
    if (!allowed || !showEjecutivo) return;
    void fetchEjecutivosComerciales()
      .then((rows) => setEjecutivos(Array.isArray(rows) ? rows : []))
      .catch(() => setEjecutivos([]));
  }, [allowed, showEjecutivo]);

  const scope = useMemo(
    () => ({
      ...(showEjecutivo && comercialId ? { comercial_id: comercialId } : {}),
      ...(segmento ? { segmento } : {}),
    }),
    [comercialId, segmento, showEjecutivo],
  );

  const committeeQuery = useMemo<CommercialReportQuery>(
    () => ({
      ...(year != null && !periodRangeActive ? { year } : {}),
      ...(quarter != null && !periodRangeActive ? { quarter } : {}),
      ...(periodRangeActive
        ? { period_from: periodFrom, period_to: periodTo }
        : {}),
      ...(fechaCorte ? { fecha_corte: fechaCorte } : {}),
      ...scope,
    }),
    [fechaCorte, periodFrom, periodRangeActive, periodTo, quarter, scope, year],
  );

  useEffect(() => {
    if (!allowed || tab !== "committee") return;
    let cancelled = false;
    void fetchCommitteeReport(committeeQuery)
      .then((result) => {
        if (cancelled) return;
        setCommittee(result);
        setError(null);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCommittee(null);
        setError(
          err instanceof ApiError && err.message
            ? err.message
            : "No se pudo cargar el comité.",
        );
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, committeeQuery, tab]);

  useEffect(() => {
    if (!allowed || tab !== "health") return;
    let cancelled = false;
    void fetchPipelineHealth(scope)
      .then((result) => {
        if (cancelled) return;
        setHealth(result);
        setError(null);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setHealth(null);
        setError(
          err instanceof ApiError && err.message
            ? err.message
            : "No se pudo cargar la salud del pipeline.",
        );
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, scope, tab]);

  const detailFilters = useCallback(() => {
    if (!detail) return null;
    const comercial = detail.comercial_id || (showEjecutivo ? comercialId : "");
    const sector = detail.segmento || segmento;
    return {
      report: detail.report,
      kind: detail.kind,
      ...(detail.report === "committee" ? committeeQuery : {}),
      ...(detail.from_estado ? { from_estado: detail.from_estado } : {}),
      ...(detail.to_estado ? { to_estado: detail.to_estado } : {}),
      ...(detail.resultado ? { resultado: detail.resultado } : {}),
      ...(comercial ? { comercial_id: comercial } : {}),
      ...(sector ? { segmento: sector } : {}),
    };
  }, [comercialId, committeeQuery, detail, segmento, showEjecutivo]);

  useEffect(() => {
    const filters = detailFilters();
    if (!filters) return;
    let ignore = false;
    const markLoading = window.setTimeout(() => {
      if (ignore) return;
      setDetailLoading(true);
      setDetailError(null);
    }, 0);
    void fetchCommercialReportDetails({
      ...filters,
      page: detailPage,
      limit: DETAIL_PAGE_SIZE,
    })
      .then((response) => {
        if (ignore) return;
        setDetailItems(response.items);
        setDetailTotal(response.total);
        setDetailAmount(response.amount_total);
        setDetailOuvCount(response.ouv_count);
        setDetailOuvAmount(response.ouv_amount);
      })
      .catch((err: unknown) => {
        if (ignore) return;
        setDetailItems([]);
        setDetailTotal(0);
        setDetailAmount(0);
        setDetailOuvCount(0);
        setDetailOuvAmount(0);
        setDetailError(
          err instanceof ApiError && err.message
            ? err.message
            : "No se pudo cargar el detalle.",
        );
      })
      .finally(() => {
        if (!ignore) setDetailLoading(false);
      });
    return () => {
      ignore = true;
      window.clearTimeout(markLoading);
    };
  }, [detailFilters, detailPage]);

  function openDetail(request: CommercialReportDetailOpen) {
    setDetailPage(1);
    setDetailLoading(true);
    setDetailError(null);
    setDetailItems([]);
    setDetailTotal(0);
    setDetailAmount(0);
    setDetailOuvCount(0);
    setDetailOuvAmount(0);
    setDetail(request);
  }

  function closeDetail() {
    setDetail(null);
    setDetailItems([]);
    setDetailError(null);
  }

  if (!allowed) {
    return (
      <AppLayout title="Reportes">
        <p className="px-6 py-10 text-sm text-ink">
          No tienes permiso para ver Reportes.
        </p>
      </AppLayout>
    );
  }

  const showStageHeader = detail?.kind.startsWith("m035_") ?? false;
  const stageSummary = `${detailOuvCount} ${detailOuvCount === 1 ? "OUV" : "OUVs"} · monto actual ${formatCompactMoney(detailOuvAmount)} (${detailTotal} ${detailTotal === 1 ? "evento" : "eventos"} · suma ${formatCompactMoney(detailAmount)})`;
  const showEventColumns = detailItems.some(
    (item) => item.from_estado || item.to_estado || item.changed_at,
  );
  const showAmountColumns = detailItems.some(
    (item) =>
      item.previous_amount != null || item.new_amount != null || item.campo,
  );

  return (
    <AppLayout title="Reportes">
      <nav
        className="mb-4 flex flex-wrap gap-1 border-b border-border"
        aria-label="Reportes"
      >
        <button
          type="button"
          className={tab === "committee" ? tabActive : tabIdle}
          onClick={() => {
            setIsLoading(committee == null);
            setTab("committee");
          }}
        >
          Comité comercial
        </button>
        <button
          type="button"
          className={tab === "health" ? tabActive : tabIdle}
          onClick={() => {
            setIsLoading(health == null);
            setTab("health");
          }}
        >
          Salud del pipeline
        </button>
      </nav>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        {tab === "committee" ? (
          <>
            <div className="w-28">
              <label className={labelClass} htmlFor="reports-year">
                Año
              </label>
              <select
                id="reports-year"
                className={inputClass}
                value={year ?? ""}
                onChange={(event) => {
                  setYear(
                    event.target.value ? Number(event.target.value) : null,
                  );
                  setQuarter(null);
                  setPeriodFrom("");
                  setPeriodTo("");
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
                value={quarter}
                disabled={year == null}
                onChange={(value) => {
                  setQuarter(value ? Number(value) : null);
                  setPeriodFrom("");
                  setPeriodTo("");
                }}
              />
            </div>
            <div className="w-48">
              <label className={labelClass} htmlFor="reports-from">
                Desde
              </label>
              <DatePickerField
                id="reports-from"
                value={periodFrom}
                aria-label="Desde"
                onChange={(value) => {
                  setPeriodFrom(value);
                  if (value && periodTo) {
                    setYear(null);
                    setQuarter(null);
                  }
                }}
              />
            </div>
            <div className="w-48">
              <label className={labelClass} htmlFor="reports-to">
                Hasta
              </label>
              <DatePickerField
                id="reports-to"
                value={periodTo}
                aria-label="Hasta"
                align="end"
                onChange={(value) => {
                  setPeriodTo(value);
                  if (periodFrom && value) {
                    setYear(null);
                    setQuarter(null);
                  }
                }}
              />
            </div>
            <div className="w-48">
              <label className={labelClass} htmlFor="reports-corte">
                Fecha de corte
              </label>
              <DatePickerField
                id="reports-corte"
                value={fechaCorte}
                aria-label="Fecha de corte"
                onChange={(value) => {
                  if (value) setFechaCorte(value);
                }}
              />
            </div>
          </>
        ) : null}
        {showEjecutivo ? (
          <div className="w-48">
            <label className={labelClass} htmlFor="reports-ejecutivo">
              Ejecutivo
            </label>
            <select
              id="reports-ejecutivo"
              className={inputClass}
              value={comercialId}
              onChange={(event) => setComercialId(event.target.value)}
            >
              <option value="">Todos</option>
              {ejecutivos.map((ejecutivo) => (
                <option key={ejecutivo.user_id} value={ejecutivo.user_id}>
                  {commercialOptionLabel(ejecutivo)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="w-52">
          <label className={labelClass} htmlFor="reports-sector">
            Sector
          </label>
          <select
            id="reports-sector"
            className={inputClass}
            value={segmento}
            onChange={(event) => setSegmento(event.target.value)}
          >
            <option value="">Todos</option>
            {SEGMENTOS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="px-6 py-10 text-center text-sm text-muted">
          Cargando reportes…
        </p>
      ) : error ? (
        <p className="px-6 py-10 text-center text-sm text-danger">{error}</p>
      ) : tab === "committee" && committee ? (
        <CommitteePanels data={committee} onOpenDetail={openDetail} />
      ) : tab === "health" && health ? (
        <PipelineHealthPanels data={health} onOpenDetail={openDetail} />
      ) : (
        <p className="px-6 py-10 text-center text-sm text-muted">Sin datos.</p>
      )}

      {detail ? (
        <ModalShell title={detail.title} onClose={closeDetail} size="wide">
          <div aria-live="polite">
            {detailLoading ? (
              <p className="py-8 text-sm text-muted">Cargando detalle…</p>
            ) : detailError ? (
              <p className="py-8 text-sm text-danger">{detailError}</p>
            ) : (
              <>
                <p
                  className="mb-3 text-sm text-ink"
                  data-detail-total={detailTotal}
                  data-detail-amount={detailAmount}
                  data-ouv-count={detailOuvCount}
                  data-ouv-amount={detailOuvAmount}
                >
                  {showStageHeader ? (
                    stageSummary
                  ) : (
                    <>
                      {detailTotal}{" "}
                      {detailTotal === 1 ? "registro" : "registros"} · suma{" "}
                      {formatCompactMoney(detailAmount)}
                    </>
                  )}
                </p>
                {detailItems.length === 0 ? (
                  <p className="py-8 text-sm text-muted">Sin registros.</p>
                ) : (
                  <div className="-mx-6 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-xs text-muted">
                          <th className="px-6 pb-2 font-bold">OUV</th>
                          <th className="pb-2 font-bold">Título</th>
                          <th className="pb-2 font-bold">Empresa</th>
                          <th className="pb-2 font-bold">Comercial</th>
                          <th className="pb-2 font-bold">Monto</th>
                          {showEventColumns ? (
                            <>
                              <th className="pb-2 font-bold">Desde</th>
                              <th className="pb-2 font-bold">Hasta</th>
                              <th className="pb-2 font-bold">Cuándo</th>
                            </>
                          ) : null}
                          {showAmountColumns ? (
                            <>
                              <th className="pb-2 font-bold">Anterior</th>
                              <th className="pb-2 pr-6 font-bold">Nuevo</th>
                            </>
                          ) : null}
                        </tr>
                      </thead>
                      <tbody>
                        {detailItems.map((item, index) => (
                          <tr
                            key={`${item.ouv_id}-${item.changed_at ?? item.fecha ?? ""}-${item.campo ?? ""}-${index}`}
                            className="border-t border-border"
                          >
                            <td className="px-6 py-2 text-ink">
                              {item.consecutivo}
                            </td>
                            <td className="py-2 pr-2 text-ink">
                              {item.titulo}
                            </td>
                            <td className="py-2 pr-2 text-ink">
                              {item.empresa || "—"}
                            </td>
                            <td className="py-2 pr-2 text-ink">
                              {item.comercial}
                            </td>
                            <td className="py-2 pr-2 text-ink">
                              {formatMoney(item.monto)}
                            </td>
                            {showEventColumns ? (
                              <>
                                <td className="py-2 pr-2 text-ink">
                                  {estadoLabel(item.from_estado)}
                                </td>
                                <td className="py-2 pr-2 text-ink">
                                  {estadoLabel(item.to_estado)}
                                </td>
                                <td className="py-2 pr-2 text-ink">
                                  {formatDateTime(item.changed_at)}
                                </td>
                              </>
                            ) : null}
                            {showAmountColumns ? (
                              <>
                                <td className="py-2 pr-2 text-ink">
                                  {formatMoney(item.previous_amount)}
                                </td>
                                <td className="py-2 pr-6 text-ink">
                                  {formatMoney(item.new_amount)}
                                </td>
                              </>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
            <Pagination
              page={detailPage}
              limit={DETAIL_PAGE_SIZE}
              total={detailTotal}
              onPageChange={setDetailPage}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={closeDetail}
              className={ghostButtonClass}
            >
              Cerrar
            </button>
          </div>
        </ModalShell>
      ) : null}
    </AppLayout>
  );
}

export default CommercialReportsPage;
