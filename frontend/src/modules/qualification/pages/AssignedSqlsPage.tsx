import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Pagination } from '../../../components/Pagination';
import { AppLayout } from '../../../layout/AppLayout';
import { formatDateTime } from '../../../lib/format';
import {
  IN_APP_NOTIFICATION_EVENT,
  type InAppNotificationEventDetail,
} from '../../../lib/notification-events';
import { useAuth } from '../../auth/hooks/useAuth';
import { fetchAssignedSqls, type SqlDetail } from '../api/sqls-api';
import { QualificationNav } from '../components/QualificationNav';

const PAGE_SIZE = 20;

function sqlAccentId(sql: SqlDetail): string {
  const raw = sql.sql_id.replace(/-/g, '').slice(0, 6).toUpperCase();
  return `SQL-${raw}`;
}

export function AssignedSqlsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isConverted = searchParams.get('bandeja') === 'convertidos';
  const estado = isConverted ? 'ConvertidoOUV' : 'Asignado';
  const redirectAdminToInbox =
    user?.role_name === 'Admin' && !isConverted;

  const [items, setItems] = useState<SqlDetail[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [isConverted]);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (redirectAdminToInbox) {
        return;
      }
      if (!opts?.silent) {
        setIsLoading(true);
      }
      setError(null);
      try {
        const data = await fetchAssignedSqls({ page, limit: PAGE_SIZE, estado });
        setItems(data.items);
        setTotal(data.total);
      } catch {
        setError('No se pudo cargar tu bandeja de SQL.');
      } finally {
        if (!opts?.silent) {
          setIsLoading(false);
        }
      }
    },
    [page, estado, redirectAdminToInbox],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on page/tray change
    void load();
  }, [load]);

  useEffect(() => {
    function onNotification(event: Event) {
      const detail = (event as CustomEvent<InAppNotificationEventDetail>)
        .detail;
      if (
        detail?.event_type === 'sql.asignado' ||
        detail?.event_type === 'sql.creado_directo' ||
        detail?.event_type === 'ouv.creada_desde_sql'
      ) {
        void load({ silent: true });
      }
    }
    window.addEventListener(IN_APP_NOTIFICATION_EVENT, onNotification);
    return () =>
      window.removeEventListener(IN_APP_NOTIFICATION_EVENT, onNotification);
  }, [load]);

  if (redirectAdminToInbox) {
    return <Navigate to="/qualification" replace />;
  }

  return (
    <AppLayout title="Calificación">
      <QualificationNav />
      <h1 className="mb-4 text-lg font-bold text-ink">
        {isConverted ? 'SQL convertidos a OUV' : 'SQL que te llegaron'}
      </h1>

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      {isLoading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : error ? null : items.length === 0 ? (
        <p className="text-sm text-muted">
          {isConverted
            ? 'Aún no hay SQL convertidos a OUV.'
            : 'No tienes SQL nuevos por trabajar.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((sql) => {
            const ouvHref = sql.ouv_id
              ? `/opportunities/${sql.ouv_id}`
              : `/qualification/sqls/${sql.sql_id}`;
            return (
              <li key={sql.sql_id}>
                <Link
                  to={isConverted ? ouvHref : `/qualification/sqls/${sql.sql_id}`}
                  className="block rounded border border-border bg-bg p-2 hover:border-accent"
                >
                  <p className="text-xs font-bold text-accent">
                    {sqlAccentId(sql)}
                  </p>
                  <p className="text-sm text-ink">
                    {String(sql.lead.empresa_nombre ?? '—')}
                  </p>
                  <p className="text-xs text-muted">
                    {isConverted
                      ? sql.ouv?.consecutivo
                        ? `OUV ${sql.ouv.consecutivo}`
                        : 'Convertido a OUV'
                      : sql.origen_creacion === 'directo_comercial'
                        ? 'Directo'
                        : 'Enrutamiento'}
                    {sql.fecha_asignacion
                      ? ` · ${formatDateTime(sql.fecha_asignacion)}`
                      : ''}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
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

export default AssignedSqlsPage;
