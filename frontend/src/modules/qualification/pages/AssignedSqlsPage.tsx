import { Calendar, CalendarClock, CalendarX2, UserPlus } from 'lucide-react';
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
import {
  cancelSqlCita,
  fetchAssignedSqls,
  type SqlDetail,
} from '../api/sqls-api';
import { AssignSqlModal } from '../components/AssignSqlModal';
import { QualificationNav } from '../components/QualificationNav';
import { RescheduleSqlCitaModal } from '../components/RescheduleSqlCitaModal';
import { cardClass } from '../components/ui';
import { sqlLeadName } from '../lib/agency-cita';

const PAGE_SIZE = 20;

export function AssignedSqlsPage() {
  const { user } = useAuth();
  const isDirector = isRoleName(
    user?.role_name,
    'DirectorMercadeo',
    'SoporteComercial',
    'Admin',
    'GestorMercadeo',
  );
  const [items, setItems] = useState<SqlDetail[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduleSql, setScheduleSql] = useState<SqlDetail | null>(null);
  const [rescheduleSql, setRescheduleSql] = useState<SqlDetail | null>(null);
  const [busySqlId, setBusySqlId] = useState<string | null>(null);

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

  function rowAction(sql: SqlDetail): 'agendar' | 'programada' | 'none' {
    if (sql.estado !== 'Asignado') {
      return 'none';
    }
    const isOwner =
      isRoleName(user?.role_name, 'EjecutivoComercial') &&
      sql.comercial_asignado_id === user?.user_id;
    const isSoporte = isRoleName(user?.role_name, 'SoporteComercial');
    if (!isSoporte && !isOwner) {
      return 'none';
    }
    return sql.cita ? 'programada' : 'agendar';
  }

  async function handleCancel(sql: SqlDetail) {
    const label = sqlLeadName(sql.lead);
    if (!window.confirm(`¿Cancelar la cita de ${label}?`)) {
      return;
    }
    setBusySqlId(sql.sql_id);
    setError(null);
    try {
      await cancelSqlCita(sql.sql_id);
      await load({ silent: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo cancelar la cita.',
      );
    } finally {
      setBusySqlId(null);
    }
  }

  return (
    <AppLayout title="Calificación">
      <QualificationNav />
      <h1 className="mb-4 text-lg font-bold text-ink">
        {isDirector ? 'SQL asignados' : 'Mis SQL asignados'}
      </h1>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <div className={cardClass}>
        {isLoading ? (
          <p className="p-6 text-sm text-muted">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-muted">
            {isDirector
              ? 'No hay SQL asignados.'
              : 'No tienes SQL asignados.'}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-bold">Lead</th>
                <th className="px-4 py-3 font-bold">Empresa</th>
                <th className="px-4 py-3 font-bold">Cita</th>
                <th className="px-4 py-3 font-bold">Estado</th>
                <th className="px-4 py-3 font-bold">Origen</th>
                <th className="px-4 py-3 font-bold">Asignado</th>
                <th className="px-4 py-3 font-bold">Acción</th>
              </tr>
            </thead>
            <tbody>
              {items.map((sql) => {
                const action = rowAction(sql);
                const label = sqlLeadName(sql.lead);
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
                      <span className="inline-flex items-start gap-2">
                        <Calendar
                          size={16}
                          className="mt-0.5 shrink-0 text-turquoise"
                          aria-hidden
                        />
                        <span className="inline-flex flex-col gap-0.5">
                          <span className="inline-flex w-fit items-center rounded-sm border border-turquoise px-2 py-0.5 text-xs font-bold text-ink">
                            {sql.cita.teams_join_url
                              ? 'Reunión Teams'
                              : 'Reunión agendada'}
                          </span>
                          <span className="text-xs text-muted">
                            {sql.cita.fecha} {sql.cita.hora.slice(0, 5)}
                          </span>
                          {sql.cita.teams_join_url ? (
                            <a
                              href={sql.cita.teams_join_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-bold text-accent hover:underline"
                            >
                              Unirse a Teams
                            </a>
                          ) : null}
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm text-muted">Sin cita</span>
                    )}
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
                  <td className="px-4 py-3">
                    {action === 'agendar' ? (
                      <button
                        type="button"
                        className="icon-btn grid h-9 w-9 place-items-center rounded text-accent"
                        title="Agendar"
                        aria-label={`Agendar ${label}`}
                        disabled={busySqlId === sql.sql_id}
                        onClick={() => setScheduleSql(sql)}
                      >
                        <UserPlus size={16} strokeWidth={2} />
                      </button>
                    ) : action === 'programada' ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="icon-btn grid h-9 w-9 place-items-center rounded"
                          title="Reagendar"
                          aria-label={`Reagendar ${label}`}
                          disabled={busySqlId === sql.sql_id}
                          onClick={() => setRescheduleSql(sql)}
                        >
                          <CalendarClock size={16} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn grid h-9 w-9 place-items-center rounded text-danger"
                          title="Cancelar"
                          aria-label={`Cancelar ${label}`}
                          disabled={busySqlId === sql.sql_id}
                          onClick={() => void handleCancel(sql)}
                        >
                          <CalendarX2 size={16} strokeWidth={2} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-muted">—</span>
                    )}
                  </td>
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
      {scheduleSql ? (
        <AssignSqlModal
          sql={scheduleSql}
          scheduleOnly
          onClose={() => setScheduleSql(null)}
          onAssigned={() => void load({ silent: true })}
          onVigenteConflict={() => void load({ silent: true })}
        />
      ) : null}
      {rescheduleSql ? (
        <RescheduleSqlCitaModal
          sql={rescheduleSql}
          onClose={() => setRescheduleSql(null)}
          onRescheduled={() => void load({ silent: true })}
        />
      ) : null}
    </AppLayout>
  );
}

export default AssignedSqlsPage;
