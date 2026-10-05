import { useCallback, useEffect, useMemo, useState } from 'react';
import { DatePickerField } from '../../../components/DatePickerField';
import { Pagination } from '../../../components/Pagination';
import { AppLayout } from '../../../layout/AppLayout';
import { ModalShell } from '../../demand-generation/components/ModalShell';
import {
  fetchQualificationDashboard,
  fetchQualificationDashboardDetails,
  type QualificationDashboard,
  type QualificationDashboardDetailItem,
  type QualificationDashboardDetailKind,
} from '../api/qualification-dashboard-api';
import {
  CitasCalificacionMeters,
  PipelineEmbudoMeters,
  MqlBandejaMeters,
} from '../components/QualificationDashboardCharts';
import { QualificationDashboardDetailTable } from '../components/QualificationDashboardDetailTable';
import { QualificationNav } from '../components/QualificationNav';
import { ghostButtonClass, inputClass, labelClass } from '../components/ui';

type DetailView = {
  kind: QualificationDashboardDetailKind;
  title: string;
};

function buildAccumulatedYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  return [currentYear, currentYear - 1, currentYear - 2];
}

export function QualificationDashboardPage() {
  const accumulatedYearOptions = useMemo(() => buildAccumulatedYearOptions(), []);
  const [accumulatedYear, setAccumulatedYear] = useState<number | null>(() =>
    new Date().getFullYear(),
  );
  const [quarter, setQuarter] = useState<number | null>(null);
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const periodRangeActive = Boolean(periodFrom && periodTo);
  const [data, setData] = useState<QualificationDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailView | null>(null);
  const [detailPage, setDetailPage] = useState(1);
  const [detailItems, setDetailItems] = useState<
    QualificationDashboardDetailItem[]
  >([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const openDetail = (kind: QualificationDashboardDetailKind, title: string) => {
    setDetailError(null);
    setDetailItems([]);
    setDetailTotal(0);
    setDetail({ kind, title });
    setDetailPage(1);
  };

  const closeDetail = () => {
    setDetail(null);
    setDetailPage(1);
  };

  const clearPeriodDates = () => {
    setPeriodFrom('');
    setPeriodTo('');
  };

  const clearAccumulatedFilters = () => {
    setAccumulatedYear(null);
    setQuarter(null);
  };

  const handleYearChange = (value: string) => {
    setAccumulatedYear(value ? Number(value) : null);
    setQuarter(null);
    clearPeriodDates();
    setDetail(null);
  };

  const handleQuarterChange = (value: string) => {
    setQuarter(value ? Number(value) : null);
    clearPeriodDates();
    setDetail(null);
  };

  const handlePeriodFromChange = (value: string) => {
    setPeriodFrom(value);
    if (value) {
      clearAccumulatedFilters();
      setDetail(null);
    }
  };

  const handlePeriodToChange = (value: string) => {
    setPeriodTo(value);
    if (value) {
      clearAccumulatedFilters();
      setDetail(null);
    }
  };

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(
        await fetchQualificationDashboard({
          ...(accumulatedYear != null ? { year: accumulatedYear } : {}),
          ...(quarter != null ? { quarter } : {}),
          ...(periodRangeActive
            ? { period_from: periodFrom, period_to: periodTo }
            : {}),
        }),
      );
    } catch {
      setError('No se pudo cargar el dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, [accumulatedYear, periodFrom, periodRangeActive, periodTo, quarter]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const periodActiveFromApi = data?.period.active ?? false;

  useEffect(() => {
    if (!detail) return;

    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    void fetchQualificationDashboardDetails({
      kind: detail.kind,
      ...(accumulatedYear != null ? { year: accumulatedYear } : {}),
      ...(quarter != null ? { quarter } : {}),
      ...(periodRangeActive
        ? { period_from: periodFrom, period_to: periodTo }
        : {}),
      page: detailPage,
      limit: 20,
    })
      .then((response) => {
        if (cancelled) return;
        setDetailItems(response.items);
        setDetailTotal(response.total);
      })
      .catch(() => {
        if (cancelled) return;
        setDetailItems([]);
        setDetailTotal(0);
        setDetailError('No se pudo cargar el detalle.');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    detail,
    detailPage,
    quarter,
    periodFrom,
    periodTo,
    periodRangeActive,
    accumulatedYear,
  ]);

  return (
    <AppLayout title="Calificación">
      <QualificationNav />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-lg font-bold text-ink">Dashboard de Calificación</h1>
        <div className="flex flex-wrap gap-3">
          <div>
            <label className={labelClass} htmlFor="qual-dashboard-year">
              Año
            </label>
            <select
              id="qual-dashboard-year"
              className={`${inputClass} min-w-24`}
              value={accumulatedYear ?? ''}
              onChange={(event) => handleYearChange(event.target.value)}
            >
              <option value="">—</option>
              {accumulatedYearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="qual-dashboard-quarter">
              Trimestre
            </label>
            <select
              id="qual-dashboard-quarter"
              className={`${inputClass} min-w-24 disabled:cursor-not-allowed disabled:opacity-50`}
              value={quarter ?? ''}
              disabled={accumulatedYear == null}
              onChange={(event) => handleQuarterChange(event.target.value)}
            >
              <option value="">—</option>
              {[1, 2, 3, 4].map((value) => (
                <option key={value} value={value}>
                  Q{value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="qual-dashboard-from">
              Desde
            </label>
            <DatePickerField
              id="qual-dashboard-from"
              className="min-w-36"
              value={periodFrom}
              aria-label="Fecha desde"
              onChange={handlePeriodFromChange}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="qual-dashboard-to">
              Hasta
            </label>
            <DatePickerField
              id="qual-dashboard-to"
              className="min-w-36"
              value={periodTo}
              aria-label="Fecha hasta"
              align="end"
              onChange={handlePeriodToChange}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="px-6 py-10 text-center text-sm text-muted">
          Cargando indicadores…
        </p>
      ) : error || !data ? (
        <p className="px-6 py-10 text-center text-sm text-muted">
          {error ?? 'Sin datos.'}
        </p>
      ) : (
        <div className="space-y-8">
          <MqlBandejaMeters
            pendingTotal={data.mql_bandeja.pending_total}
            withCita={data.mql_bandeja.with_cita}
            activeKind={detail?.kind ?? null}
            onOpenDetail={openDetail}
          />

          <CitasCalificacionMeters
            periodActive={periodActiveFromApi}
            scheduled={data.citas_calificacion.scheduled_by_commercial}
            executed={data.citas_calificacion.executed}
            sqlAssignedInPeriod={
              data.citas_calificacion.sql_assigned_in_period
            }
            sqlConvertedToOuv={
              data.citas_calificacion.sql_converted_to_ouv_in_period
            }
            activeKind={detail?.kind ?? null}
            onOpenDetail={openDetail}
          />

          <PipelineEmbudoMeters
            periodActive={periodActiveFromApi}
            openZonas={data.pipeline.open_zonas}
            won={data.pipeline.ouvs_won_in_period}
            lost={data.pipeline.ouvs_lost_in_period}
            discarded={data.pipeline.ouvs_discarded_in_period}
            activeKind={detail?.kind ?? null}
            onOpenDetail={openDetail}
          />
        </div>
      )}

      {detail ? (
        <ModalShell title={detail.title} onClose={closeDetail} size="wide">
          <div aria-live="polite">
            {detailLoading ? (
              <p className="py-8 text-sm text-muted">Cargando detalle…</p>
            ) : detailError ? (
              <p className="py-8 text-sm text-muted">{detailError}</p>
            ) : detailItems.length === 0 ? (
              <p className="py-8 text-sm text-muted">
                Sin registros en este periodo.
              </p>
            ) : (
              <div className="-mx-6">
                <QualificationDashboardDetailTable
                  kind={detail.kind}
                  items={detailItems}
                />
              </div>
            )}
            <Pagination
              page={detailPage}
              limit={20}
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

export default QualificationDashboardPage;
