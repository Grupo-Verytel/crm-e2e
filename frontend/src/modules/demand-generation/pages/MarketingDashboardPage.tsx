import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '../../../layout/AppLayout';
import { fetchMarketingDashboard } from '../api/dashboard-api';
import { DemandNav } from '../components/DemandNav';
import { StatusBadge } from '../components/StatusBadge';
import { cardClass } from '../components/ui';
import type { MarketingDashboard } from '../types';

const FUNNEL_LABELS: Record<string, string> = {
  TOFU: 'TOFU',
  MOFU: 'MOFU',
  MQL_PENDING: 'MQL',
  SQL: 'SQL',
};

export function MarketingDashboardPage() {
  const [data, setData] = useState<MarketingDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await fetchMarketingDashboard());
    } catch {
      setError('No se pudo cargar el dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <AppLayout title="Dashboard de mercadeo">
      <DemandNav />

      <h1 className="mb-4 text-lg font-bold text-ink">Indicadores de mercadeo</h1>

      {isLoading ? (
        <p className="px-6 py-10 text-center text-sm text-muted">Cargando indicadores…</p>
      ) : error || !data ? (
        <p className="px-6 py-10 text-center text-sm text-muted">
          {error ?? 'Sin datos.'}
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Leads totales" value={String(data.total_leads)} />
            <KpiCard
              label="% calificados"
              value={`${(data.qualified_rate * 100).toFixed(1)}%`}
            />
            <KpiCard
              label="CPL promedio"
              value={data.average_cpl != null ? `$${data.average_cpl}` : '—'}
            />
            <KpiCard label="MQL pendientes" value={String(data.pending_mqls)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={`${cardClass} p-5`}>
              <h2 className="mb-4 text-sm font-bold text-ink">
                Embudo TOFU → MOFU → MQL → SQL
              </h2>
              <Funnel funnel={data.funnel} />
            </div>

            <div className={`${cardClass} p-5`}>
              <h2 className="mb-4 text-sm font-bold text-ink">Leads por segmento</h2>
              <SegmentBars segments={data.leads_by_segment} />
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${cardClass} p-5`}>
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold text-brand">{value}</p>
    </div>
  );
}

function Funnel({ funnel }: { funnel: MarketingDashboard['funnel'] }) {
  const max = Math.max(1, ...funnel.map((stage) => stage.count));

  return (
    <div className="space-y-3">
      {funnel.map((stage) => (
        <div key={stage.estado}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <StatusBadge value={stage.estado} />
            <span className="font-bold text-ink">{stage.count}</span>
          </div>
          <div className="h-3 w-full rounded-sm bg-bg">
            <div
              className="h-3 rounded-sm bg-brand"
              style={{ width: `${(stage.count / max) * 100}%` }}
              aria-label={`${FUNNEL_LABELS[stage.estado] ?? stage.estado}: ${stage.count}`}
            />
          </div>
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
  if (segments.length === 0) {
    return <p className="text-sm text-muted">Sin leads registrados.</p>;
  }

  const max = Math.max(1, ...segments.map((segment) => segment.count));

  return (
    <div className="space-y-3">
      {segments.map((segment) => (
        <div key={segment.segmento}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-ink">{segment.segmento}</span>
            <span className="font-bold text-ink">{segment.count}</span>
          </div>
          <div className="h-3 w-full rounded-sm bg-bg">
            <div
              className="h-3 rounded-sm bg-turquoise"
              style={{ width: `${(segment.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
