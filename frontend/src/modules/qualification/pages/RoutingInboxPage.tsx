import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pagination } from '../../../components/Pagination';
import { AppLayout } from '../../../layout/AppLayout';
import { formatDateTime } from '../../../lib/format';
import {
  IN_APP_NOTIFICATION_EVENT,
  type InAppNotificationEventDetail,
} from '../../../lib/notification-events';
import { isRoleName } from '../../../lib/roles';
import { useAuth } from '../../auth/hooks/useAuth';
import { fetchSqlInbox } from '../api/sqls-api';
import { AssignSqlModal } from '../components/AssignSqlModal';
import { QualificationNav } from '../components/QualificationNav';
import { cardClass, primaryButtonClass } from '../components/ui';
import {
  needsAgencyCitaGeneration,
  sqlLeadName,
} from '../lib/agency-cita';
import type { SqlDetail } from '../api/sqls-api';

const PAGE_SIZE = 20;

export function RoutingInboxPage() {
  const { user } = useAuth();
  const canAssign = isRoleName(user?.role_name, 'SoporteComercial', 'Admin');
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

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <div className={cardClass}>
        {isLoading ? (
          <p className="p-6 text-sm text-muted">Cargando…</p>
        ) : error ? (
          <p className="p-6 text-sm text-muted">
            Reintenta cargar la bandeja o verifica tus permisos.
          </p>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-muted">
            No hay SQL pendientes de asignación.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-bold">Lead</th>
                <th className="px-4 py-3 font-bold">Empresa</th>
                <th className="px-4 py-3 font-bold">Cita</th>
                <th className="px-4 py-3 font-bold">Creado</th>
                {canAssign ? (
                  <th className="px-4 py-3 font-bold">Acción</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {items.map((sql) => {
                const pendingCita = needsAgencyCitaGeneration(sql);
                return (
                <tr key={sql.sql_id} className="border-b border-border">
                  <td className="px-4 py-3">
                    <Link
                      to={`/qualification/sqls/${sql.sql_id}`}
                      className="font-bold text-accent hover:underline"
                    >
                      {sqlLeadName(sql.lead)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {String(sql.lead.empresa_nombre ?? '—')}
                  </td>
                  <td className="px-4 py-3">
                    {sql.cita ? (
                      <span className="text-sm text-ink">
                        Agendada · {sql.cita.fecha} {sql.cita.hora.slice(0, 5)}
                      </span>
                    ) : pendingCita ? (
                      <span className="inline-flex flex-col gap-0.5">
                        <span className="rounded bg-accent/10 px-1.5 py-0.5 text-xs font-bold text-accent">
                          Generar cita
                        </span>
                        <span className="text-xs text-muted">
                          {formatDateTime(
                            typeof sql.lead.fecha_cita === 'string'
                              ? sql.lead.fecha_cita
                              : null,
                          )}
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatDateTime(sql.fecha_creacion)}
                  </td>
                  {canAssign ? (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className={primaryButtonClass}
                        onClick={() => setSelected(sql)}
                      >
                        Asignar
                      </button>
                    </td>
                  ) : null}
                </tr>
                );
              })}
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
