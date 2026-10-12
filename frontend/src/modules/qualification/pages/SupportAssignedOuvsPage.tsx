import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pagination } from '../../../components/Pagination';
import { AppLayout } from '../../../layout/AppLayout';
import { useModuleSearch } from '../../../layout/module-search';
import {
  IN_APP_NOTIFICATION_EVENT,
  type InAppNotificationEventDetail,
} from '../../../lib/notification-events';
import { fetchOuvs, type Ouv } from '../../discovery/api/ouvs-api';
import { OUV_ZONA_LABEL } from '../../discovery/lib/ouv-vocab';
import { OUV_REMINDERS_CHANGED_EVENT } from '../../shared/reminders/types';
import {
  fetchCommercials,
  type CommercialOption,
} from '../api/sqls-api';
import { AssignedCommercialFiltersPanel } from '../components/AssignedCommercialFiltersPanel';
import { QualificationNav } from '../components/QualificationNav';
import {
  EMPTY_ASSIGNED_COMMERCIAL_FILTERS,
  type AssignedCommercialFilters,
} from '../lib/assigned-filters';
import {
  daysWithoutOuvSeguimiento,
  ouvSeguimientoTone,
  sortOuvsBySeguimiento,
} from '../lib/ouv-seguimiento';
import {
  SQL_SEGUIMIENTO_TONE_CLASS,
  SQL_SEGUIMIENTO_TONE_LABEL,
  type SqlSeguimientoSort,
} from '../lib/sql-seguimiento';

const PAGE_SIZE = 20;

export function SupportAssignedOuvsPage() {
  const navigate = useNavigate();
  const { query } = useModuleSearch();
  const [items, setItems] = useState<Ouv[]>([]);
  const [commercials, setCommercials] = useState<CommercialOption[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<AssignedCommercialFilters>(
    EMPTY_ASSIGNED_COMMERCIAL_FILTERS,
  );
  const [seguimientoSort, setSeguimientoSort] =
    useState<SqlSeguimientoSort | null>(null);
  const [remindersTick, setRemindersTick] = useState(0);

  const sortedItems = useMemo(
    () =>
      seguimientoSort
        ? sortOuvsBySeguimiento(items, seguimientoSort)
        : items,
    [items, seguimientoSort, remindersTick],
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setIsLoading(true);
      }
      setError(null);
      try {
        const data = await fetchOuvs({
          page,
          limit: PAGE_SIZE,
          resultado: 'EnCurso',
          q: query || undefined,
          all: true,
          comercial_id: applied.comercial_id || undefined,
        });
        setItems(data.items);
        setTotal(data.total);
      } catch {
        setError('No se pudo cargar OUV asignadas.');
      } finally {
        if (!opts?.silent) {
          setIsLoading(false);
        }
      }
    },
    [applied, page, query],
  );

  useEffect(() => {
    fetchCommercials()
      .then(setCommercials)
      .catch(() => setCommercials([]));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on page change
    void load();
  }, [load]);

  useEffect(() => {
    function refreshReminders() {
      setRemindersTick((n) => n + 1);
    }
    window.addEventListener(OUV_REMINDERS_CHANGED_EVENT, refreshReminders);
    window.addEventListener('storage', refreshReminders);
    return () => {
      window.removeEventListener(OUV_REMINDERS_CHANGED_EVENT, refreshReminders);
      window.removeEventListener('storage', refreshReminders);
    };
  }, []);

  useEffect(() => {
    function onNotification(event: Event) {
      const detail = (event as CustomEvent<InAppNotificationEventDetail>)
        .detail;
      if (
        detail?.event_type === 'ouv.creada_desde_sql' ||
        detail?.event_type === 'ouv.creada'
      ) {
        void load({ silent: true });
      }
    }
    window.addEventListener(IN_APP_NOTIFICATION_EVENT, onNotification);
    return () =>
      window.removeEventListener(IN_APP_NOTIFICATION_EVENT, onNotification);
  }, [load]);

  return (
    <AppLayout title="Calificación">
      <QualificationNav />
      <AssignedCommercialFiltersPanel
        panelId="assigned-ouvs-filters-panel"
        commercials={commercials}
        applied={applied}
        onApply={(next) => {
          setApplied(next);
          setPage(1);
        }}
      />

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      {isLoading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : error ? null : items.length === 0 ? (
        <p className="text-sm text-muted">No hay OUV asignadas todavía.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-bold">OUV</th>
                <th className="px-4 py-3 font-bold">Título</th>
                <th className="px-4 py-3 font-bold">Empresa</th>
                <th className="px-4 py-3 font-bold">Etapa</th>
                <th className="px-4 py-3 font-bold">Comercial</th>
                <th className="px-4 py-3 text-center font-bold">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-1 uppercase tracking-wide text-muted hover:text-ink"
                    aria-label={
                      seguimientoSort === 'verdes'
                        ? 'Ordenar seguimiento por rojos'
                        : 'Ordenar seguimiento por verdes'
                    }
                    onClick={() =>
                      setSeguimientoSort((current) =>
                        current === 'verdes' ? 'rojos' : 'verdes',
                      )
                    }
                  >
                    Seguimiento
                    <span aria-hidden="true" className="text-[10px]">
                      {seguimientoSort === 'rojos'
                        ? '▼'
                        : seguimientoSort === 'verdes'
                          ? '▲'
                          : '↕'}
                    </span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((ouv) => {
                const tone = ouvSeguimientoTone(ouv.ouv_id);
                const days = daysWithoutOuvSeguimiento(ouv.ouv_id);
                return (
                  <tr
                    key={ouv.ouv_id}
                    onClick={() => navigate(`/opportunities/${ouv.ouv_id}`)}
                    className="cursor-pointer border-b border-border hover:bg-bg"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/opportunities/${ouv.ouv_id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="font-bold text-accent hover:underline"
                      >
                        {ouv.consecutivo}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink">{ouv.titulo}</td>
                    <td className="px-4 py-3 text-ink">{ouv.empresa_nombre}</td>
                    <td className="px-4 py-3 text-ink">
                      {OUV_ZONA_LABEL[ouv.zona_actual] ?? ouv.zona_actual}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {ouv.comercial_nombre?.trim() || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full ${SQL_SEGUIMIENTO_TONE_CLASS[tone]}`}
                        title={
                          tone === 'vacio'
                            ? SQL_SEGUIMIENTO_TONE_LABEL.vacio
                            : `${SQL_SEGUIMIENTO_TONE_LABEL[tone]} (${days} días)`
                        }
                        aria-label={
                          tone === 'vacio'
                            ? SQL_SEGUIMIENTO_TONE_LABEL.vacio
                            : `${SQL_SEGUIMIENTO_TONE_LABEL[tone]}. ${days} días`
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4">
        <Pagination
          page={page}
          total={total}
          limit={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>
    </AppLayout>
  );
}

export default SupportAssignedOuvsPage;
