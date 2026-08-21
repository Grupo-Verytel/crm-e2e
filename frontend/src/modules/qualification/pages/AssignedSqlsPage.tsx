import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pagination } from '../../../components/Pagination';
import { AppLayout } from '../../../layout/AppLayout';
import { formatDateTime } from '../../../lib/format';
import {
  IN_APP_NOTIFICATION_EVENT,
  type InAppNotificationEventDetail,
} from '../../../lib/notification-events';
import { fetchAssignedSqls, type SqlDetail } from '../api/sqls-api';
import { QualificationNav } from '../components/QualificationNav';
import { cardClass } from '../components/ui';

const PAGE_SIZE = 20;

export function AssignedSqlsPage() {
  const [items, setItems] = useState<SqlDetail[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const data = await fetchAssignedSqls({ page, limit: PAGE_SIZE });
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setError('No se pudo cargar tu bandeja de SQL.');
    } finally {
      if (!opts?.silent) {
        setIsLoading(false);
      }
    }
  }, [page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on page change
    void load();
  }, [load]);

  useEffect(() => {
    function onNotification(event: Event) {
      const detail = (event as CustomEvent<InAppNotificationEventDetail>)
        .detail;
      if (detail?.event_type === 'sql.asignado' || detail?.event_type === 'sql.creado_directo') {
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
      <h1 className="mb-4 text-lg font-bold text-ink">Mis SQL asignados</h1>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <div className={cardClass}>
        {isLoading ? (
          <p className="p-6 text-sm text-muted">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-muted">No tienes SQL asignados.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-bold">Empresa</th>
                <th className="px-4 py-3 font-bold">Estado</th>
                <th className="px-4 py-3 font-bold">Origen</th>
                <th className="px-4 py-3 font-bold">Asignado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((sql) => (
                <tr key={sql.sql_id} className="border-b border-border">
                  <td className="px-4 py-3">
                    <Link
                      to={`/qualification/sqls/${sql.sql_id}`}
                      className="font-bold text-accent hover:underline"
                    >
                      {String(sql.lead.empresa_nombre ?? '—')}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink">{sql.estado}</td>
                  <td className="px-4 py-3">
                    {sql.origen_creacion === 'directo_comercial' ? (
                      <span className="rounded bg-accent/10 px-1.5 py-0.5 text-xs font-bold text-accent">
                        Directo
                      </span>
                    ) : (
                      <span className="text-xs text-muted">Enrutamiento</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatDateTime(sql.fecha_asignacion)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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

export default AssignedSqlsPage;
