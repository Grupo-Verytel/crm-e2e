import { useEffect, useMemo, useState } from 'react';
import { Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DatePickerField } from '../../../components/DatePickerField';
import { FiscalQuarterSelect } from '../../../components/FiscalQuarterSelect';
import { AppLayout } from '../../../layout/AppLayout';
import { ApiError } from '../../auth/types';
import { useAuth } from '../../auth/hooks/useAuth';
import {
  commercialOptionLabel,
  fetchEjecutivosComerciales,
  type EjecutivoComercialOption,
} from '../api/catalogos-api';
import {
  fetchOuvDashboard,
  type OuvDashboard,
} from '../api/ouv-dashboard-api';
import { DiscoveryNav } from '../components/DiscoveryNav';
import { OuvDashboardPanels } from '../components/OuvDashboardPanels';
import { inputClass, labelClass } from '../components/ui';
import { canReadAllOuvs } from '../lib/ouv-access';
import { formatPeriodDate } from '../lib/ouv-dashboard-format';
import { SEGMENTOS } from '../lib/ouv-vocab';
import { hasCommercialGoalPermission } from '../../commercial-goals/lib/can-read-commercial-goals';

function yearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  return [currentYear, currentYear - 1, currentYear - 2];
}

export function OuvDashboardPage() {
  const { user } = useAuth();
  const showEjecutivo = canReadAllOuvs(user?.role_name);
  const showGoals = hasCommercialGoalPermission(user, 'read');
  const years = useMemo(() => yearOptions(), []);
  const [year, setYear] = useState<number | null>(() => new Date().getFullYear());
  const [quarter, setQuarter] = useState<number | null>(null);
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [comercialId, setComercialId] = useState('');
  const [segmento, setSegmento] = useState('');
  const [ejecutivos, setEjecutivos] = useState<EjecutivoComercialOption[]>([]);
  const [data, setData] = useState<OuvDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const periodRangeActive = Boolean(periodFrom && periodTo);

  useEffect(() => {
    if (!showEjecutivo) return;
    void fetchEjecutivosComerciales()
      .then((rows) => setEjecutivos(Array.isArray(rows) ? rows : []))
      .catch(() => setEjecutivos([]));
  }, [showEjecutivo]);

  useEffect(() => {
    let cancelled = false;
    void fetchOuvDashboard({
      ...(year != null && !periodRangeActive ? { year } : {}),
      ...(quarter != null && !periodRangeActive ? { quarter } : {}),
      ...(periodRangeActive
        ? { period_from: periodFrom, period_to: periodTo }
        : {}),
      ...(showEjecutivo && comercialId ? { comercial_id: comercialId } : {}),
      ...(segmento ? { segmento } : {}),
    })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setData(null);
        setError(
          err instanceof ApiError && err.message
            ? err.message
            : 'No se pudo cargar el tablero.',
        );
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    comercialId,
    periodFrom,
    periodRangeActive,
    periodTo,
    quarter,
    segmento,
    showEjecutivo,
    year,
  ]);

  const periodCaption =
    data?.period.active && data.period.period_from && data.period.period_to
      ? `${formatPeriodDate(data.period.period_from)} – ${formatPeriodDate(data.period.period_to)}`
      : 'Todo el historial';

  return (
    <AppLayout title="Oportunidades (OUV)">
      <DiscoveryNav showAdminTabs={false} />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Dirección comercial · Oportunidades únicas de venta
          </p>
          <h1 className="text-lg font-bold text-ink">Tablero de OUVs</h1>
          <p className="text-xs text-muted">{periodCaption}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-28">
            <label className={labelClass} htmlFor="ouv-dashboard-year">
              Año
            </label>
            <select
              id="ouv-dashboard-year"
              className={inputClass}
              value={year ?? ''}
              onChange={(event) => {
                setYear(event.target.value ? Number(event.target.value) : null);
                setQuarter(null);
                setPeriodFrom('');
                setPeriodTo('');
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
            <label className={labelClass} htmlFor="ouv-dashboard-quarter">
              Trimestre
            </label>
            <FiscalQuarterSelect
              id="ouv-dashboard-quarter"
              className={`${inputClass} min-w-52 disabled:cursor-not-allowed disabled:opacity-50`}
              value={quarter}
              disabled={year == null}
              onChange={(value) => {
                setQuarter(value ? Number(value) : null);
                setPeriodFrom('');
                setPeriodTo('');
              }}
            />
          </div>
          <div className="w-48">
            <label className={labelClass} htmlFor="ouv-dashboard-from">
              Desde
            </label>
            <DatePickerField
              id="ouv-dashboard-from"
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
            <label className={labelClass} htmlFor="ouv-dashboard-to">
              Hasta
            </label>
            <DatePickerField
              id="ouv-dashboard-to"
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
          {showEjecutivo ? (
            <div className="w-48">
              <label className={labelClass} htmlFor="ouv-dashboard-ejecutivo">
                Ejecutivo
              </label>
              <select
                id="ouv-dashboard-ejecutivo"
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
            <label className={labelClass} htmlFor="ouv-dashboard-sector">
              Sector
            </label>
            <select
              id="ouv-dashboard-sector"
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
          {showGoals ? (
            <Link
              to="/dashboard/metas-comerciales"
              title="Metas comerciales"
              aria-label="Metas comerciales"
              className="btn-glow-outline inline-flex h-10 w-10 shrink-0 items-center justify-center self-start rounded focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Settings size={18} aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>
      {periodFrom !== periodTo && (!periodFrom || !periodTo) ? (
        <p className="-mt-2 mb-4 text-xs text-muted">
          Elige desde y hasta para usar un rango. Hasta entonces sigue el año o
          el trimestre.
        </p>
      ) : null}

      {isLoading ? (
        <p className="px-6 py-10 text-center text-sm text-muted">
          Cargando tablero…
        </p>
      ) : error || !data ? (
        <p className="px-6 py-10 text-center text-sm text-danger">
          {error ?? 'Sin datos.'}
        </p>
      ) : (
        <OuvDashboardPanels data={data} />
      )}
    </AppLayout>
  );
}

export default OuvDashboardPage;
