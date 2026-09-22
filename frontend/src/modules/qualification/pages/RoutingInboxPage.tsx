import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pagination } from '../../../components/Pagination';
import { AppLayout } from '../../../layout/AppLayout';
import { useModuleSearch } from '../../../layout/module-search';
import {
  IN_APP_NOTIFICATION_EVENT,
  type InAppNotificationEventDetail,
} from '../../../lib/notification-events';
import { useAuth } from '../../auth/hooks/useAuth';
import { hasPermission } from '../../auth/lib/permission-catalog';
import {
  fetchCommercials,
  fetchSqlInbox,
  type CommercialOption,
  type SqlDetail,
} from '../api/sqls-api';
import { AssignSqlModal } from '../components/AssignSqlModal';
import { QualificationNav } from '../components/QualificationNav';
import { SqlRoutingPlannedCitaCell } from '../components/SqlRoutingPlannedCitaCell';
import { primaryButtonClass } from '../components/ui';
import { splitDateTimeLines } from '../lib/sql-appointments';

const PAGE_SIZE = 20;

function leadLabel(sql: SqlDetail): string {
  return String(sql.lead.empresa_nombre ?? sql.lead.contacto_nombre ?? '—');
}

export function RoutingInboxPage() {
  const { user } = useAuth();
  const { query } = useModuleSearch();
  const [items, setItems] = useState<SqlDetail[]>([]);
  const [commercials, setCommercials] = useState<CommercialOption[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SqlDetail | null>(null);

  const canAssign =
    user?.role_name === 'Admin' ||
    hasPermission(user?.permissions, 'assign', 'Sql');

  const commercialNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const commercial of commercials) {
      map.set(commercial.user_id, commercial.full_name);
    }
    return map;
  }, [commercials]);

  useEffect(() => {
    fetchCommercials()
      .then(setCommercials)
      .catch(() => setCommercials([]));
  }, []);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const data = await fetchSqlInbox({
        page,
        limit: PAGE_SIZE,
        q: query || undefined,
      });
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
  }, [page, query]);

  useEffect(() => {
    setPage(1);
  }, [query]);

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

  function resolveCommercialName(sql: SqlDetail): string | null {
    const id =
      sql.cita_planificada?.comercial_asignado_id ??
      (typeof sql.lead.comercial_asignado_id === 'string'
        ? sql.lead.comercial_asignado_id
        : null);
    if (!id) return null;
    return commercialNames.get(id) ?? null;
  }

  return (
    <AppLayout title="Calificación">
      <QualificationNav />
      <h1 className="mb-4 text-lg font-bold text-ink">Bandeja de enrutamiento</h1>

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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-bold">Lead</th>
                <th className="px-4 py-3 font-bold">Empresa</th>
                <th className="px-4 py-3 font-bold">Cita</th>
                <th className="px-4 py-3 font-bold">Creado</th>
                <th className="px-4 py-3 font-bold">Acción</th>
              </tr>
            </thead>
            <tbody>
              {items.map((sql) => {
                const label = leadLabel(sql);
                const created = splitDateTimeLines(sql.fecha_creacion);
                return (
                  <tr
                    key={sql.sql_id}
                    className="border-b border-border hover:bg-bg"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/qualification/sqls/${sql.sql_id}`}
                        className="font-bold text-accent hover:underline"
                      >
                        {label}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink">{label}</td>
                    <td className="px-4 py-3">
                      <SqlRoutingPlannedCitaCell
                        citaPlanificada={sql.cita_planificada}
                        comercialName={resolveCommercialName(sql)}
                      />
                    </td>
                    <td className="px-4 py-3 text-ink">
                      <span className="block">{created.primary}</span>
                      {created.secondary ? (
                        <span className="block text-muted">{created.secondary}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {canAssign ? (
                        <button
                          type="button"
                          className={primaryButtonClass}
                          onClick={() => setSelected(sql)}
                        >
                          Asignar
                        </button>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
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

      {selected ? (
        <AssignSqlModal
          sql={selected}
          onClose={() => setSelected(null)}
          onAssigned={() => void load({ silent: true })}
        />
      ) : null}
    </AppLayout>
  );
}

export default RoutingInboxPage;
