import { useCallback, useEffect, useMemo, useState } from 'react';
import { List } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DatePickerField } from '../../../components/DatePickerField';
import { Pagination } from '../../../components/Pagination';
import { AppLayout } from '../../../layout/AppLayout';
import { useAuth } from '../../auth/hooks/useAuth';
import {
  fetchMarketingDashboard,
  fetchMarketingDashboardDetails,
} from '../api/dashboard-api';
import { DemandNav, canOpenMqlInbox } from '../components/DemandNav';
import { ModalShell } from '../components/ModalShell';
import { cardClass, ghostButtonClass, inputClass, labelClass } from '../components/ui';
import { CANAL_ORIGEN_LABEL, leadEstadoLabel } from '../lib/lead-vocab';
import { OUV_ZONA_LABEL, type OuvZona } from '../../discovery/lib/ouv-vocab';
import {
  CANALES_ORIGEN,
  INTERACTION_CANAL_LABEL,
  INTERACTION_TIPO_LABEL,
  SEGMENTOS,
  type CanalOrigen,
  type InteractionCanal,
  type InteractionTipo,
  type MarketingDashboard,
  type MarketingDashboardDetailItem,
  type MarketingDashboardDetailKind,
} from '../types';

const FUNNEL_LABELS: Record<string, string> = {
  TOFU: 'TOFU',
  MOFU: 'MOFU',
  MQL_PENDING: 'BOFU',
  SQL: 'SQL',
};

type DetailView = {
  kind: MarketingDashboardDetailKind;
  title: string;
  estado?: string;
};

function buildAccumulatedYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  return [currentYear, currentYear - 1, currentYear - 2];
}

function parseYmd(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysInclusive(from: string, to: string): number | null {
  const start = parseYmd(from);
  const end = parseYmd(to);
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function periodLeadsLabelFromRange(from: string, to: string): string {
  const days = daysInclusive(from, to);
  if (days == null) return 'Leads del periodo';
  if (days <= 7) return 'Leads de la semana';
  if (days <= 15) return 'Leads de los 15 días';
  return 'Leads del periodo';
}

export function MarketingDashboardPage() {
  const { user } = useAuth();
  const showMqlInbox = canOpenMqlInbox(user?.role_name);
  const accumulatedYearOptions = useMemo(() => buildAccumulatedYearOptions(), []);
  const [accumulatedYear, setAccumulatedYear] = useState<number | null>(null);
  const [quarter, setQuarter] = useState<number | null>(null);
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const periodRangeActive = Boolean(periodFrom && periodTo);
  const [data, setData] = useState<MarketingDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailView | null>(null);
  const [detailPage, setDetailPage] = useState(1);
  const [detailItems, setDetailItems] = useState<MarketingDashboardDetailItem[]>(
    [],
  );
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const periodLeadsLabel = useMemo(() => {
    if (periodRangeActive) {
      return periodLeadsLabelFromRange(periodFrom, periodTo);
    }
    if (accumulatedYear != null && quarter != null) {
      return `Leads del Q${quarter} ${accumulatedYear}`;
    }
    if (accumulatedYear != null) {
      return `Leads del ${accumulatedYear}`;
    }
    return 'Leads del periodo';
  }, [
    accumulatedYear,
    periodFrom,
    periodRangeActive,
    periodTo,
    quarter,
  ]);
  const channelBarsData = useMemo(() => {
    if (!data) return [];
    if (periodRangeActive) return data.weekly.leads_by_channel ?? [];
    if (accumulatedYear != null) {
      return data.weekly.quarter_leads_by_channel ?? [];
    }
    return [];
  }, [accumulatedYear, data, periodRangeActive]);
  const channelBarsTitle = periodRangeActive
    ? 'Leads creados por canal de origen'
    : accumulatedYear != null
      ? 'Leads acumulados por canal de origen'
      : 'Leads por canal de origen';

  const openDetail = (view: DetailView) => {
    setDetail(view);
    setDetailPage(1);
  };

  const closeDetail = useCallback(() => {
    setDetail(null);
    setDetailItems([]);
    setDetailTotal(0);
    setDetailError(null);
    setDetailPage(1);
  }, []);

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
        await fetchMarketingDashboard({
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
  }, [quarter, periodFrom, periodTo, periodRangeActive, accumulatedYear]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!detail) {
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    void fetchMarketingDashboardDetails({
      kind: detail.kind,
      estado: detail.estado,
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
    <AppLayout title="Dashboard de mercadeo">
      <DemandNav />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-lg font-bold text-ink">Indicadores de mercadeo</h1>
        <div className="flex flex-wrap gap-3">
          <div>
            <label className={labelClass} htmlFor="dashboard-accumulated-year">
              Año
            </label>
            <select
              id="dashboard-accumulated-year"
              className={`${inputClass} min-w-24`}
              value={accumulatedYear ?? ''}
              title="Año del acumulado (independiente)"
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
            <label className={labelClass} htmlFor="dashboard-quarter">
              Trimestre
            </label>
            <select
              id="dashboard-quarter"
              className={`${inputClass} min-w-52 disabled:cursor-not-allowed disabled:opacity-50`}
              value={quarter ?? ''}
              disabled={accumulatedYear == null}
              title={
                accumulatedYear == null
                  ? 'Selecciona un año primero'
                  : 'Trimestre del año seleccionado'
              }
              onChange={(event) => handleQuarterChange(event.target.value)}
            >
              <option value="">Todo el año fiscal</option>
              <option value="1">Q1 · 01 feb – 30 abr</option>
              <option value="2">Q2 · 01 may – 31 jul</option>
              <option value="3">Q3 · 01 ago – 31 oct</option>
              <option value="4">Q4 · 01 nov – 31 ene</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="dashboard-period-from">
              Desde
            </label>
            <DatePickerField
              id="dashboard-period-from"
              className="min-w-36"
              value={periodFrom}
              aria-label="Fecha desde"
              onChange={handlePeriodFromChange}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="dashboard-period-to">
              Hasta
            </label>
            <DatePickerField
              id="dashboard-period-to"
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
        <p className="px-6 py-10 text-center text-sm text-muted">Cargando indicadores…</p>
      ) : error || !data ? (
        <p className="px-6 py-10 text-center text-sm text-muted">
          {error ?? 'Sin datos.'}
        </p>
      ) : (
        <div className="space-y-4">
          <section aria-labelledby="funnel-dashboard-title">
            <h2 id="funnel-dashboard-title" className="sr-only">
              Embudo TOFU MOFU BOFU SQL
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
              {data.funnel
                .filter((stage) => stage.estado !== 'SQL')
                .map((stage) => (
                  <article key={stage.estado} className={`${cardClass} px-4 py-3`}>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">
                      {FUNNEL_LABELS[stage.estado] ?? stage.estado}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-ink">{stage.count}</p>
                  </article>
                ))}
              {showMqlInbox ? (
                <Link
                  to="/demand/mqls"
                  className={`${cardClass} px-4 py-3 focus-visible:ring-2 focus-visible:ring-brand`}
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    MQL pendientes
                  </p>
                  <p className="mt-1 text-2xl font-bold text-ink">
                    {data.pending_mqls}
                  </p>
                </Link>
              ) : (
                <article className={`${cardClass} px-4 py-3`}>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    MQL pendientes
                  </p>
                  <p className="mt-1 text-2xl font-bold text-ink">
                    {data.pending_mqls}
                  </p>
                </article>
              )}
              {data.funnel
                .filter((stage) => stage.estado === 'SQL')
                .map((stage) => (
                  <article key={stage.estado} className={`${cardClass} px-4 py-3`}>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">
                      {FUNNEL_LABELS[stage.estado] ?? stage.estado}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-ink">{stage.count}</p>
                  </article>
                ))}
              <article className={`${cardClass} px-4 py-3`}>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  Tiempo promedio
                </p>
                <p className="mt-1 text-2xl text-ink">
                  {data.average_conversion_days == null ? (
                    '—'
                  ) : (
                    <>
                      <span className="font-bold">
                        {data.average_conversion_days}
                      </span>{' '}
                      <span className="text-sm font-normal">días</span>
                    </>
                  )}
                </p>
              </article>
            </div>
          </section>

          <section aria-labelledby="period-dashboard-title">
            <h2
              id="period-dashboard-title"
              className="mb-3 text-sm font-bold text-ink"
            >
              Indicadores del periodo
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DonutMetric
                label="Interacciones"
                value={data.weekly.interactions}
                target={50}
                onViewData={() =>
                  openDetail({ kind: 'interactions', title: 'Interacciones' })
                }
              />
              <DonutMetric
                label={periodLeadsLabel}
                value={data.weekly.new_leads}
                target={3}
                onViewData={() =>
                  openDetail({ kind: 'period_leads', title: periodLeadsLabel })
                }
              />
              <DonutMetric
                label="OUV convertidas"
                value={data.weekly.converted_ouvs ?? 0}
                target={3}
                onViewData={() =>
                  openDetail({ kind: 'ouvs', title: 'OUV convertidas' })
                }
              />
            </div>
          </section>

          <section className={`${cardClass} p-5`}>
            <h2 className="mb-4 text-sm font-bold text-ink">
              {channelBarsTitle}
            </h2>
            <ChannelHorizontalBars channels={channelBarsData} />
          </section>

          <section className={`${cardClass} p-5`}>
            <h2 className="mb-4 text-sm font-bold text-ink">Leads por segmento</h2>
            <SegmentBars segments={data.leads_by_segment} />
          </section>
        </div>
      )}

      {detail ? (
        <ModalShell title={detail.title} onClose={closeDetail} size="wide">
          <div aria-live="polite">
            {detailLoading ? (
              <p className="py-8 text-sm text-muted">Cargando detalle…</p>
            ) : detailError ? (
              <p className="py-8 text-sm text-muted">{detailError}</p>
            ) : !Array.isArray(detailItems) || detailItems.length === 0 ? (
              <p className="py-8 text-sm text-muted">
                Sin registros en este periodo.
              </p>
            ) : (
              <div className="-mx-6">
                <DashboardDetailTable kind={detail.kind} items={detailItems} />
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
            <button type="button" onClick={closeDetail} className={ghostButtonClass}>
              Cerrar
            </button>
          </div>
        </ModalShell>
      ) : null}
    </AppLayout>
  );
}

function dash(value: string | null | undefined): string {
  return value?.trim() || '—';
}

function canalOrigenLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return CANAL_ORIGEN_LABEL[value as CanalOrigen] ?? value;
}

function tipoComunicacionLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return INTERACTION_TIPO_LABEL[value as InteractionTipo] ?? value;
}

function canalComunicacionLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return INTERACTION_CANAL_LABEL[value as InteractionCanal] ?? value;
}

function zonaOuvLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return OUV_ZONA_LABEL[value as OuvZona] ?? value;
}

function daysAsOuv(days: number | null | undefined): string {
  if (days === null || days === undefined || !Number.isFinite(days)) {
    return '—';
  }
  return days === 1 ? '1 día' : `${days} días`;
}

function detailHref(item: MarketingDashboardDetailItem): string {
  return item.entity === 'ouv'
    ? `/opportunities/${item.id}`
    : `/demand/leads/${item.id}`;
}

function DashboardDetailTable({
  kind,
  items,
}: {
  kind: MarketingDashboardDetailKind;
  items: MarketingDashboardDetailItem[];
}) {
  const columns =
    kind === 'interactions'
      ? [
          'Empresa',
          'Segmento',
          'Origen',
          'Canal de origen',
          'Tipo de comunicación',
          'Canal',
        ]
      : kind === 'ouvs'
        ? ['OUV', 'Empresa', 'Segmento', 'Fase', 'Días transcurridos']
        : ['Empresa', 'Segmento', 'Origen', 'Canal de origen', 'Estado'];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="border-b border-border bg-bg text-xs uppercase text-muted">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-5 py-3 font-bold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item) => (
            <tr key={item.interaction_id ?? `${item.entity}-${item.id}`}>
              {kind === 'ouvs' ? (
                <td className="px-5 py-3">
                  <Link
                    to={detailHref(item)}
                    className="font-bold text-ink hover:text-accent"
                  >
                    {dash(item.consecutivo)}
                  </Link>
                </td>
              ) : null}
              <td className="px-5 py-3">
                <Link
                  to={detailHref(item)}
                  className="font-bold text-ink hover:text-accent"
                >
                  {dash(item.empresa)}
                </Link>
              </td>
              <td className="px-5 py-3 text-ink">{dash(item.segmento)}</td>
              <td className="px-5 py-3 text-ink">
                {kind === 'ouvs' ? zonaOuvLabel(item.estado) : dash(item.origen)}
              </td>
              <td className="px-5 py-3 text-ink">
                {kind === 'ouvs'
                  ? daysAsOuv(item.dias_transcurridos)
                  : canalOrigenLabel(item.canal_origen)}
              </td>
              {kind === 'interactions' ? (
                <>
                  <td className="px-5 py-3 text-ink">
                    {tipoComunicacionLabel(item.tipo_comunicacion)}
                  </td>
                  <td className="px-5 py-3 text-ink">
                    {canalComunicacionLabel(item.canal)}
                  </td>
                </>
              ) : null}
              {kind === 'period_leads' || kind === 'quarter_leads' || kind === 'funnel' ? (
                <td className="px-5 py-3 text-ink">
                  {leadEstadoLabel(item.estado ?? '')}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DonutMetric({
  label,
  value,
  target,
  onViewData,
}: {
  label: string;
  value: number;
  target: number;
  onViewData?: () => void;
}) {
  const ratio = target > 0 ? value / target : 0;
  const percentage = Math.round(ratio * 100);
  const progress = Math.min(100, percentage);
  const toneClass =
    ratio >= 0.9
      ? 'bg-semaphore-verde/15 text-semaphore-verde'
      : ratio >= 0.5
        ? 'bg-warning/15 text-warning'
        : 'bg-danger/10 text-danger';
  const progressClass =
    ratio >= 0.9
      ? 'text-semaphore-verde'
      : ratio >= 0.5
        ? 'text-warning'
        : 'text-danger';

  return (
    <article className={`${cardClass} relative flex items-center gap-4 p-5 pr-12`}>
      {onViewData ? (
        <button
          type="button"
          onClick={onViewData}
          title="Ver datos"
          aria-label={`Ver datos de ${label}`}
          className="absolute right-3 top-3 rounded p-1.5 text-muted hover:text-accent focus-visible:ring-2 focus-visible:ring-brand"
        >
          <List size={18} strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}
      <div className="relative h-28 w-28 shrink-0" aria-hidden>
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            className="text-border"
          />
          <circle
            cx="60"
            cy="60"
            r="48"
            pathLength="100"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${progress} ${100 - progress}`}
            className={progressClass}
          />
        </svg>
        <span
          className={`absolute inset-0 grid place-items-center text-3xl font-bold ${progressClass}`}
        >
          {value}
        </span>
      </div>
      <div className="min-w-0">
        <h3 className="font-bold text-ink">{label}</h3>
        <p className="mt-1 text-xs text-muted">Meta: {target}</p>
        <span
          className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-bold ${toneClass}`}
        >
          {percentage}%
        </span>
      </div>
    </article>
  );
}

function ChannelHorizontalBars({
  channels,
}: {
  channels: MarketingDashboard['weekly']['leads_by_channel'];
}) {
  const counts = new Map(
    (channels ?? []).map((row) => [row.canal_origen, row.count]),
  );
  const data = CANALES_ORIGEN.map((canal) => ({
    canal_origen: canal,
    count: counts.get(canal) ?? 0,
  }));
  const max = Math.max(1, ...data.map((row) => row.count));

  return (
    <div className="space-y-4">
      {data.map((row) => (
        <div
          key={row.canal_origen}
          className="grid gap-2 md:grid-cols-[14rem_minmax(0,1fr)_3rem] md:items-center"
        >
          <p className="text-sm text-ink">
            {CANAL_ORIGEN_LABEL[row.canal_origen]}
          </p>
          <div className="h-3 overflow-hidden rounded-sm bg-bg">
            <div
              className="h-full rounded-sm bg-turquoise"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </div>
          <span className="text-right text-sm text-ink">
            {row.count}
          </span>
        </div>
      ))}
    </div>
  );
}

function SegmentBars({
  segments,
}: {
  segments: MarketingDashboard['leads_by_segment'];
}) {
  const counts = new Map(
    (segments ?? []).map((row) => [row.segmento, row.count]),
  );
  const data = SEGMENTOS.map((segmento) => ({
    segmento,
    count: counts.get(segmento) ?? 0,
  }));
  const max = Math.max(1, ...data.map((row) => row.count));

  return (
    <div className="space-y-5">
      {data.map((row) => (
        <div
          key={row.segmento}
          className="grid gap-2 md:grid-cols-[16rem_minmax(0,1fr)_3rem] md:items-center"
        >
          <p className="text-sm text-ink">{row.segmento}</p>
          <div className="h-4 overflow-hidden rounded-sm bg-bg">
            <div
              className="h-full rounded-sm bg-accent"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </div>
          <span className="text-right text-sm text-ink">
            {row.count}
          </span>
        </div>
      ))}
    </div>
  );
}
