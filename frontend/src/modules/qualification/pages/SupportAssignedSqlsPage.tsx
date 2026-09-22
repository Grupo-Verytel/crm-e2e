import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pagination } from '../../../components/Pagination';
import { AppLayout } from '../../../layout/AppLayout';
import { useModuleSearch } from '../../../layout/module-search';
import { formatDateTime } from '../../../lib/format';
import {
  IN_APP_NOTIFICATION_EVENT,
  type InAppNotificationEventDetail,
} from '../../../lib/notification-events';
import { fetchAssignedSqls, type SqlDetail } from '../api/sqls-api';
import { QualificationNav } from '../components/QualificationNav';
import { SqlCitaMeetingCell } from '../components/SqlCitaMeetingCell';
import { resolveSqlOrigenLabel } from '../lib/sql-appointments';

const PAGE_SIZE = 20;

function leadLabel(sql: SqlDetail): string {
  return String(sql.lead.empresa_nombre ?? sql.lead.contacto_nombre ?? '—');
}

export function SupportAssignedSqlsPage() {
  const navigate = useNavigate();
  const { query } = useModuleSearch();
  const [items, setItems] = useState<SqlDetail[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    [page, query],
  );

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on page change
    void load();
  }, [load]);

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
                <th className="px-4 py-3 font-bold">Estado</th>
                <th className="px-4 py-3 font-bold">Origen</th>
                <th className="px-4 py-3 font-bold">Asignado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((sql) => {
                const label = leadLabel(sql);
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
                    <td className="px-4 py-3 text-ink">{sql.estado}</td>
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
