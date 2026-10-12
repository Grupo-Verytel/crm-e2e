import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pagination } from '../../../components/Pagination';
import { AppLayout } from '../../../layout/AppLayout';
import { useModuleSearch } from '../../../layout/module-search';
import { formatDateTime } from '../../../lib/format';
import {
  IN_APP_NOTIFICATION_EVENT,
  type InAppNotificationEventDetail,
} from '../../../lib/notification-events';
import { OUV_REMINDERS_CHANGED_EVENT } from '../../shared/reminders/types';
import {
  fetchAssignedSqls,
  fetchCommercials,
  type CommercialOption,
  type SqlDetail,
} from '../api/sqls-api';
import { AssignedCommercialFiltersPanel } from '../components/AssignedCommercialFiltersPanel';
import { QualificationNav } from '../components/QualificationNav';
import { SqlCitaMeetingCell } from '../components/SqlCitaMeetingCell';
import {
  EMPTY_ASSIGNED_COMMERCIAL_FILTERS,
  type AssignedCommercialFilters,
} from '../lib/assigned-filters';
import { resolveSqlOrigenLabel } from '../lib/sql-appointments';
import {
  daysWithoutSeguimiento,
  sortSqlsBySeguimiento,
  SQL_SEGUIMIENTO_TONE_CLASS,
  SQL_SEGUIMIENTO_TONE_LABEL,
  sqlSeguimientoTone,
  type SqlSeguimientoSort,
} from '../lib/sql-seguimiento';

const PAGE_SIZE = 20;

function leadLabel(sql: SqlDetail): string {
  return String(sql.lead.empresa_nombre ?? sql.lead.contacto_nombre ?? '—');
}

export function SupportAssignedSqlsPage() {
  const navigate = useNavigate();
  const { query } = useModuleSearch();
  const [items, setItems] = useState<SqlDetail[]>([]);
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
        ? sortSqlsBySeguimiento(items, seguimientoSort)
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
        const data = await fetchAssignedSqls({
          page,
          limit: PAGE_SIZE,
          q: query || undefined,
          comercial_asignado_id: applied.comercial_id || undefined,
        });
        setItems(data.items);
        setTotal(data.total);
      } catch {
        setError('No se pudo cargar SQL asignados.');
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
        detail?.event_type === 'sql.asignado' ||
        detail?.event_type === 'ouv.creada_desde_sql'
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
        panelId="assigned-sqls-filters-panel"
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
        <p className="text-sm text-muted">No hay SQL asignados todavía.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-bold">Lead</th>
                <th className="px-4 py-3 font-bold">Empresa</th>
                <th className="px-4 py-3 font-bold">Cita</th>
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
                <th className="px-4 py-3 font-bold">Origen</th>
                <th className="px-4 py-3 font-bold">Asignado</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((sql) => {
                const label = leadLabel(sql);
                const tone = sqlSeguimientoTone(sql);
                const days = daysWithoutSeguimiento(sql);
                return (
                  <tr
                    key={sql.sql_id}
                    onClick={() => navigate(`/qualification/sqls/${sql.sql_id}`)}
                    className="cursor-pointer border-b border-border hover:bg-bg"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/qualification/sqls/${sql.sql_id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="font-bold text-accent hover:underline"
                      >
                        {label}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink">{label}</td>
                    <td className="px-4 py-3">
                      <SqlCitaMeetingCell
                        cita={sql.cita}
                        citaPlanificada={sql.cita_planificada}
                        leadLabel={label}
                      />
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
                    <td className="px-4 py-3 text-ink">
                      {resolveSqlOrigenLabel(sql.origen_creacion)}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {formatDateTime(sql.fecha_asignacion)}
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

export default SupportAssignedSqlsPage;
