import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Pagination } from "../../../components/Pagination";
import { AppLayout } from "../../../layout/AppLayout.tsx";
import { formatDateTime } from "../../../lib/format";
import { verytelQuarterOf } from "../../commercial-goals/lib/verytel-quarter";
import { ModalShell } from "../../demand-generation/components/ModalShell";
import { ApiError } from "../../auth/types";
import { useAuth } from "../../auth/hooks/useAuth.ts";
import { ReportFilterBar } from "../../reports/components/ReportFilterBar";
import {
  fechaCorteFromSearch,
  filterSearchKey,
  filtersFromSearch,
  serializeFilters,
  type ReportKind,
  type ReportPageFilters,
} from "../../reports/lib/report-filters";
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
import { ghostButtonClass } from "../components/ui";
import { hasCommercialReportPermission } from "../lib/can-read-commercial-report";
import { canReadAllOuvs } from "../lib/ouv-access";
import { formatCompactMoney } from "../lib/ouv-dashboard-format";
import { OUV_ZONA_LABEL, type OuvZona, SEGMENTOS } from "../lib/ouv-vocab";

const DETAIL_PAGE_SIZE = 20;

const PAGE_COPY: Record<ReportKind, { title: string; question: string }> = {
  committee: {
    title: "Comité comercial",
    question: "¿Qué cambió desde el último comité y cómo está el periodo?",
  },
  "pipeline-health": {
    title: "Salud del pipeline",
    question: "¿Cuántas OUVs abiertas llevan más de un año y cuál es su edad?",
  },
};

function reportFromPath(pathname: string): ReportKind {
  return pathname.startsWith("/reports/pipeline-health")
    ? "pipeline-health"
    : "committee";
}

function yearOptions(selected: number | null): number[] {
  const fiscalYear = verytelQuarterOf(new Date()).fiscalYear;
  const currentYear = new Date().getFullYear();
  return [
    ...new Set(
      [fiscalYear, selected, currentYear, currentYear - 1, currentYear - 2].filter(
        (value): value is number => value != null,
      ),
    ),
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

export function CommercialReportsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const report = reportFromPath(location.pathname);
  const copy = PAGE_COPY[report];
  const allowed = hasCommercialReportPermission(user);
  const showEjecutivo = canReadAllOuvs(user?.role_name);
  const filterKey = filterSearchKey(searchParams, report);
  const fechaCorte = fechaCorteFromSearch(searchParams);
  const applied = useMemo(
    () => filtersFromSearch(new URLSearchParams(filterKey), report),
    [filterKey, report],
  );
  const urlIdentity = `${report}|${filterKey}`;
  const [seenUrl, setSeenUrl] = useState(urlIdentity);
  const [draft, setDraft] = useState<ReportPageFilters>(applied);
  if (seenUrl !== urlIdentity) {
    setSeenUrl(urlIdentity);
    setDraft(applied);
  }
  const [ejecutivos, setEjecutivos] = useState<EjecutivoComercialOption[]>([]);
  const [committeeLoaded, setCommitteeLoaded] = useState<{
    periodKey: string;
    corte: string;
    data: CommitteeReport;
  } | null>(null);
  const [healthLoaded, setHealthLoaded] = useState<{
    key: string;
    data: PipelineHealthReport;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorIdentity, setErrorIdentity] = useState<string | null>(null);
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
  const years = useMemo(
    () => yearOptions(draft.year ?? applied.year),
    [applied.year, draft.year],
  );

  useEffect(() => {
    if (!allowed || !showEjecutivo) return;
    void fetchEjecutivosComerciales()
      .then((rows) => setEjecutivos(Array.isArray(rows) ? rows : []))
      .catch(() => setEjecutivos([]));
  }, [allowed, showEjecutivo]);

  const periodQuery = useMemo<CommercialReportQuery>(() => {
    const range = Boolean(applied.periodFrom && applied.periodTo);
    return {
      ...(applied.year != null && !range ? { year: applied.year } : {}),
      ...(applied.quarter != null && applied.year != null && !range
        ? { quarter: applied.quarter }
        : {}),
      ...(range
        ? { period_from: applied.periodFrom, period_to: applied.periodTo }
        : {}),
      ...(showEjecutivo && applied.comercialId
        ? { comercial_id: applied.comercialId }
        : {}),
      ...(applied.segmento ? { segmento: applied.segmento } : {}),
    };
  }, [
    applied.comercialId,
    applied.periodFrom,
    applied.periodTo,
    applied.quarter,
    applied.segmento,
    applied.year,
    showEjecutivo,
  ]);
  const periodKey = JSON.stringify(periodQuery);
  const requestIdentity = `${report}|${periodKey}|${fechaCorte}`;
  const detailIdentity = `${report}|${periodKey}|${fechaCorte}`;
  const [seenDetail, setSeenDetail] = useState(detailIdentity);
  if (seenDetail !== detailIdentity) {
    setSeenDetail(detailIdentity);
    setDetail(null);
  }
  const committeeQuery = useMemo<CommercialReportQuery>(
    () =>
      report === "committee"
        ? { ...periodQuery, fecha_corte: fechaCorte }
        : periodQuery,
    [fechaCorte, periodQuery, report],
  );
  const healthQuery = useMemo(
    () => ({
      ...(showEjecutivo && applied.comercialId
        ? { comercial_id: applied.comercialId }
        : {}),
      ...(applied.segmento ? { segmento: applied.segmento } : {}),
    }),
    [applied.comercialId, applied.segmento, showEjecutivo],
  );
  const healthKey = JSON.stringify(healthQuery);
  const committee =
    report === "committee" && committeeLoaded?.periodKey === periodKey
      ? committeeLoaded.data
      : null;
  const health =
    report === "pipeline-health" && healthLoaded?.key === healthKey
      ? healthLoaded.data
      : null;
  const activeIdentity =
    report === "committee" ? requestIdentity : `health|${healthKey}`;
  const visibleError = errorIdentity === activeIdentity ? error : null;
  const mobilizationUpdating =
    committee != null &&
    committeeLoaded?.corte !== fechaCorte &&
    visibleError == null;

  useEffect(() => {
    if (!allowed || report !== "committee") return;
    let cancelled = false;
    void fetchCommitteeReport(committeeQuery)
      .then((result) => {
        if (cancelled) return;
        setCommitteeLoaded({ periodKey, corte: fechaCorte, data: result });
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorIdentity(requestIdentity);
        setError(
          err instanceof ApiError && err.message
            ? err.message
            : "No se pudo cargar el comité.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, committeeQuery, fechaCorte, periodKey, report, requestIdentity]);

  useEffect(() => {
    if (!allowed || report !== "pipeline-health") return;
    let cancelled = false;
    const identity = `health|${healthKey}`;
    void fetchPipelineHealth(healthQuery)
      .then((result) => {
        if (cancelled) return;
        setHealthLoaded({ key: healthKey, data: result });
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorIdentity(identity);
        setError(
          err instanceof ApiError && err.message
            ? err.message
            : "No se pudo cargar la salud del pipeline.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, healthKey, healthQuery, report]);

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

  function onFechaCorteChange(value: string) {
    const next = new URLSearchParams(searchParams);
    const canonical = fechaCorteFromSearch(new URLSearchParams());
    if (value === canonical) next.delete("fecha_corte");
    else next.set("fecha_corte", value);
    setSearchParams(next);
  }

  function onApply() {
    setSearchParams(serializeFilters(draft, report, fechaCorte));
  }

  function onClear() {
    setSearchParams(new URLSearchParams());
  }

  useEffect(() => {
    if (!detail) return;
    let ignore = false;
    const comercial =
      detail.comercial_id ||
      (showEjecutivo ? applied.comercialId : "");
    const sector = detail.segmento || applied.segmento;
    const filters = {
      report: detail.report,
      kind: detail.kind,
      ...(detail.report === "committee" ? committeeQuery : {}),
      ...(detail.from_estado ? { from_estado: detail.from_estado } : {}),
      ...(detail.to_estado ? { to_estado: detail.to_estado } : {}),
      ...(detail.resultado ? { resultado: detail.resultado } : {}),
      ...(comercial ? { comercial_id: comercial } : {}),
      ...(sector ? { segmento: sector } : {}),
      page: detailPage,
      limit: DETAIL_PAGE_SIZE,
    };
    const markLoading = window.setTimeout(() => {
      if (ignore) return;
      setDetailLoading(true);
      setDetailError(null);
    }, 0);
    void fetchCommercialReportDetails(filters)
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
  }, [
    applied.comercialId,
    applied.segmento,
    committeeQuery,
    detail,
    detailPage,
    showEjecutivo,
  ]);

  if (!allowed) {
    return (
      <AppLayout title={copy.title}>
        <p className="px-6 py-10 text-sm text-ink">
          No tienes permiso para ver Reportes.
        </p>
      </AppLayout>
    );
  }

  const comercialName =
    ejecutivos.find((row) => row.user_id === applied.comercialId) ?? null;
  const showStageHeader = detail?.kind.startsWith("m035_") ?? false;
  const stageSummary = `${detailOuvCount} ${detailOuvCount === 1 ? "OUV" : "OUVs"} · monto actual ${formatCompactMoney(detailOuvAmount)} (${detailTotal} ${detailTotal === 1 ? "evento" : "eventos"} · suma ${formatCompactMoney(detailAmount)})`;
  const showEventColumns = detailItems.some(
    (item) => item.from_estado || item.to_estado || item.changed_at,
  );
  const showAmountColumns = detailItems.some(
    (item) =>
      item.previous_amount != null || item.new_amount != null || item.campo,
  );
  const waiting =
    visibleError == null &&
    (report === "committee" ? committee == null : health == null);

  return (
    <AppLayout title={copy.title}>
      <h1 className="text-lg font-bold text-ink">{copy.title}</h1>
      <p className="mb-4 text-sm text-muted">{copy.question}</p>

      <ReportFilterBar
        report={report}
        draft={draft}
        applied={applied}
        years={years}
        showComercial={showEjecutivo}
        segments={SEGMENTOS}
        comercialOptions={ejecutivos.map((row) => ({
          value: row.user_id,
          label: commercialOptionLabel(row),
        }))}
        comercialName={
          comercialName ? commercialOptionLabel(comercialName) : null
        }
        onDraftChange={setDraft}
        onApply={onApply}
        onClear={onClear}
      />

      {visibleError && (committee != null || health != null) ? (
        <p className="mb-3 text-sm text-danger">{visibleError}</p>
      ) : null}

      {waiting ? (
        <p className="px-6 py-10 text-center text-sm text-muted">
          Cargando reportes…
        </p>
      ) : visibleError && committee == null && health == null ? (
        <p className="px-6 py-10 text-center text-sm text-danger">
          {visibleError}
        </p>
      ) : report === "committee" && committee ? (
        <CommitteePanels
          data={committee}
          fechaCorte={fechaCorte}
          mobilizationUpdating={mobilizationUpdating}
          onFechaCorteChange={onFechaCorteChange}
          onOpenDetail={openDetail}
        />
      ) : report === "pipeline-health" && health ? (
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
                            <td className="py-2 pr-2 text-ink">{item.titulo}</td>
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
