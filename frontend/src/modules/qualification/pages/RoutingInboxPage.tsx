import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pagination } from '../../../components/Pagination';
import { AppLayout } from '../../../layout/AppLayout';
import { formatDateTime } from '../../../lib/format';
import {
  IN_APP_NOTIFICATION_EVENT,
  type InAppNotificationEventDetail,
} from '../../../lib/notification-events';
import { fetchSqlInbox } from '../api/sqls-api';
import { AssignSqlModal } from '../components/AssignSqlModal';
import { QualificationNav } from '../components/QualificationNav';
import { primaryButtonClass } from '../components/ui';
import type { SqlDetail } from '../api/sqls-api';

const PAGE_SIZE = 20;

function sqlAccentId(sql: SqlDetail): string {
  const raw = sql.sql_id.replace(/-/g, '').slice(0, 6).toUpperCase();
  return `SQL-${raw}`;
}

export function RoutingInboxPage() {
  const [items, setItems] = useState<SqlDetail[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SqlDetail | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const data = await fetchSqlInbox({ page, limit: PAGE_SIZE });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'No se pudo cargar la bandeja de enrutamiento.';
      setError(message);
      setItems([]);
      setTotal(0);
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
      const detail = (event as CustomEvent<InAppNotificationEventDetail>).detail;
      if (
        detail?.event_type === 'lead.mql_aprobado' ||
        detail?.event_type === 'sql.creado'
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
      <h1 className="mb-4 text-lg font-bold text-ink">
        Bandeja de enrutamiento
      </h1>

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      {isLoading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : error ? (
        <p className="text-sm text-muted">
          Reintenta cargar la bandeja o verifica tus permisos.
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">No hay SQL pendientes de asignación.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((sql) => (
            <li key={sql.sql_id}>
              <div className="flex flex-wrap items-center gap-3 rounded border border-border bg-bg p-2 hover:border-accent">
                <Link
                  to={`/qualification/sqls/${sql.sql_id}`}
                  className="min-w-0 flex-1"
                >
                  <p className="text-xs font-bold text-accent">
                    {sqlAccentId(sql)}
                  </p>
                  <p className="text-sm text-ink">
                    {String(sql.lead.empresa_nombre ?? '—')}
                  </p>
                  <p className="text-xs text-muted">
                    {String(sql.lead.contacto_nombre ?? '—')}
                    {' · '}
                    {formatDateTime(sql.fecha_creacion)}
                  </p>
                </Link>
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() => setSelected(sql)}
                >
                  Asignar
                </button>
              </div>
            </li>
          ))}
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

      {selected ? (
        <AssignSqlModal
          sql={selected}
          onClose={() => setSelected(null)}
          onAssigned={() => void load()}
        />
      ) : null}
    </AppLayout>
  );
}

export default RoutingInboxPage;
