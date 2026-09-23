import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../../../layout/AppLayout';
import { SqlInteractionTimeline } from '../components/SqlInteractionTimeline';
import { useAuth } from '../../auth/hooks/useAuth';
import { hasPermission } from '../../auth/lib/permission-catalog';
import { fetchSql, type SqlDetail } from '../api/sqls-api';
import { AssignSqlModal } from '../components/AssignSqlModal';
import { ConvertirSqlEnOuvModal } from '../components/ConvertirSqlEnOuvModal';
import {
  SqlAgendaStatusModule,
  SqlPlannedCitaModule,
  SqlScheduledCitaModule,
} from '../components/SqlAgendaPanel';
import { SqlDetailInfoModule } from '../components/SqlDetailInfoModule';
import { SqlDetailNav, type SqlDetailTab } from '../components/SqlDetailNav';
import { cardClass, primaryButtonClass } from '../components/ui';
import { hasScheduledCita } from '../lib/sql-appointments';

function sqlAccentId(sql: SqlDetail): string {
  const raw = sql.sql_id.replace(/-/g, '').slice(0, 6).toUpperCase();
  return `SQL-${raw}`;
}

function sqlLeadLabel(sql: SqlDetail): string {
  return String(sql.lead.empresa_nombre ?? sql.lead.contacto_nombre ?? 'SQL');
}

export function SqlDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sql, setSql] = useState<SqlDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [detailTab, setDetailTab] = useState<SqlDetailTab>('detalle');
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const canAssign =
    user?.role_name === 'Admin' ||
    hasPermission(user?.permissions, 'assign', 'Sql');
  const backHref = canAssign ? '/qualification' : '/qualification/assigned';
  const backLabel = canAssign
    ? '← Volver a enrutamiento'
    : '← Volver a me llegaron';

  const loadSql = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      setSql(await fetchSql(id));
    } catch {
      setError('No se pudo cargar el SQL.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount
    void loadSql();
  }, [loadSql]);

  const canConvert =
    hasPermission(user?.permissions, 'create', 'Sql') &&
    sql?.estado === 'Asignado' &&
    sql.comercial_asignado_id === user?.user_id;

  const canSchedule =
    sql?.estado === 'Asignado' &&
    sql.comercial_asignado_id === user?.user_id &&
    !hasScheduledCita(sql.cita);

  const headerTitle = sql ? sqlLeadLabel(sql) : 'SQL';

  return (
    <AppLayout title="Calificación">
      <Link
        to={backHref}
        className="mb-3 inline-block text-sm text-muted hover:text-ink"
      >
        {backLabel}
      </Link>

      {isLoading ? <p className="text-sm text-muted">Cargando…</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {sql ? (
        <>
          <section className={`${cardClass} mb-4 p-5`}>
            <p className="text-xs font-bold text-accent">{sqlAccentId(sql)}</p>
            <h1 className="mt-1 text-lg font-bold text-ink">{headerTitle}</h1>
            <p className="text-sm text-muted">
              {[sql.lead.contacto_nombre, sql.lead.email]
                .filter((value) => typeof value === 'string' && value.length > 0)
                .join(' · ') || 'Sin contacto'}
            </p>
          </section>

          <SqlDetailNav active={detailTab} onChange={setDetailTab} />

          {detailTab === 'interacciones' ? (
            <SqlInteractionTimeline
              sqlId={sql.sql_id}
              sqlLabel={headerTitle}
              onRegistered={() => void loadSql()}
            />
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <SqlDetailInfoModule
                  sql={sql}
                  canConvert={Boolean(canConvert)}
                  onConvert={() => setShowConvertModal(true)}
                />
                <SqlAgendaStatusModule
                  citaPlanificada={sql.cita_planificada}
                  cita={sql.cita}
                />
                <SqlPlannedCitaModule
                  citaPlanificada={sql.cita_planificada}
                  cita={sql.cita}
                />
                <SqlScheduledCitaModule cita={sql.cita} />
              </div>

              {canSchedule ? (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    className={primaryButtonClass}
                    onClick={() => setShowScheduleModal(true)}
                  >
                    Agendar cita con cliente
                  </button>
                </div>
              ) : null}
            </>
          )}
        </>
      ) : null}

      {showScheduleModal && sql ? (
        <AssignSqlModal
          sql={sql}
          scheduleOnly
          hideCommercialField
          fixedCommercialId={user?.user_id}
          onClose={() => setShowScheduleModal(false)}
          onAssigned={() => {
            setShowScheduleModal(false);
            void loadSql();
          }}
        />
      ) : null}

      {showConvertModal && sql ? (
        <ConvertirSqlEnOuvModal
          sql={sql}
          onClose={() => setShowConvertModal(false)}
          onConverted={(ouvId) => {
            navigate(`/opportunities/${ouvId}`);
          }}
        />
      ) : null}
    </AppLayout>
  );
}

export default SqlDetailPage;
