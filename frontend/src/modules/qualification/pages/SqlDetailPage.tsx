import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppLayout } from '../../../layout/AppLayout';
import { ApiError } from '../../auth/types';
import { formatDateTime } from '../../../lib/format';
import { isRoleName } from '../../../lib/roles';
import { InteractionTimeline } from '../../demand-generation/components/InteractionTimeline';
import type { CreateInteractionPayload } from '../../demand-generation/types';
import { useAuth } from '../../auth/hooks/useAuth';
import {
  createSqlInteractionReminder,
  fetchSqlInteractions,
  registerSqlInteraction,
} from '../api/sql-interactions-api';
import { closeSqlCita, fetchSql, type SqlDetail } from '../api/sqls-api';
import { AssignSqlModal } from '../components/AssignSqlModal';
import { ConvertirSqlEnOuvModal } from '../components/ConvertirSqlEnOuvModal';
import { QualificationNav } from '../components/QualificationNav';
import { SqlCitaTraceCard } from '../components/SqlCitaTraceCard';
import { SqlDetailNav, type SqlDetailTab } from '../components/SqlDetailNav';
import { cardClass, ghostButtonClass, primaryButtonClass } from '../components/ui';
import { needsAgencyCitaGeneration, sqlLeadName } from '../lib/agency-cita';
import { isOpenSqlCitaEstado } from '../types/sql-appointment-event.types';
import { citaContactosFromLead } from '../lib/cita-contactos';
import {
  formatLeadOrigin,
  formatLeadSourceChannel,
} from '../lib/lead-source-labels';

const REGISTRABLE_ESTADOS = new Set(['PendienteAsignacion', 'Asignado']);

function sqlAccentId(sqlId: string): string {
  return `SQL-${sqlId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

function backLink(
  from: string | null,
  roleName: string | undefined,
): { to: string; label: string } {
  const assignedLabel = isRoleName(
    roleName,
    'DirectorMercadeo',
    'SoporteComercial',
    'Admin',
    'GestorMercadeo',
  )
    ? '← Volver a SQL asignados'
    : '← Volver a Mis SQL';

  if (from === 'routing') {
    return { to: '/qualification', label: '← Volver a enrutamiento' };
  }
  if (from === 'assigned') {
    return { to: '/qualification/assigned', label: assignedLabel };
  }
  if (isRoleName(roleName, 'SoporteComercial')) {
    return { to: '/qualification', label: '← Volver a enrutamiento' };
  }
  return { to: '/qualification/assigned', label: assignedLabel };
}

export function SqlDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sql, setSql] = useState<SqlDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [detailTab, setDetailTab] = useState<SqlDetailTab>(
    searchParams.get('tab') === 'interacciones' ? 'interacciones' : 'detalle',
  );
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [listVersion, setListVersion] = useState(0);
  const [traceVersion, setTraceVersion] = useState(0);
  const [closingOutcome, setClosingOutcome] = useState<
    'Realizada' | 'NoAsistio' | null
  >(null);

  const loadSql = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      setSql(await fetchSql(id));
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 403 &&
        isRoleName(user?.role_name, 'EjecutivoComercial')
      ) {
        navigate('/qualification/assigned', { replace: true });
        return;
      }
      setError('No se pudo cargar el SQL.');
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate, user?.role_name]);

  useEffect(() => {
    void loadSql();
  }, [loadSql]);

  const back = backLink(searchParams.get('from'), user?.role_name);
  const canConvert =
    user?.role_name === 'EjecutivoComercial' &&
    sql?.estado === 'Asignado' &&
    sql.comercial_asignado_id === user.user_id;
  const canManageCita =
    sql != null &&
    sql.estado === 'Asignado' &&
    (isRoleName(user?.role_name, 'SoporteComercial', 'Admin') ||
      (isRoleName(user?.role_name, 'EjecutivoComercial') &&
        sql.comercial_asignado_id === user?.user_id));
  const canRegister =
    sql != null &&
    REGISTRABLE_ESTADOS.has(sql.estado) &&
    (isRoleName(user?.role_name, 'SoporteComercial', 'Admin') ||
      (isRoleName(user?.role_name, 'EjecutivoComercial') &&
        sql.comercial_asignado_id === user?.user_id));
  const canCloseCita =
    canManageCita && sql.cita != null && isOpenSqlCitaEstado(sql.cita.estado);
  const canScheduleNewCita =
    canManageCita &&
    (sql.cita == null || !isOpenSqlCitaEstado(sql.cita.estado));

  async function handleCloseCita(resultado: 'Realizada' | 'NoAsistio') {
    if (!sql) return;
    const confirmLabel =
      resultado === 'Realizada'
        ? '¿Marcar la reunión como ejecutada?'
        : '¿Marcar que no asistieron a la reunión?';
    if (!window.confirm(confirmLabel)) {
      return;
    }
    setClosingOutcome(resultado);
    setError(null);
    try {
      await closeSqlCita(sql.sql_id, resultado);
      await loadSql();
      setTraceVersion((value) => value + 1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo registrar el resultado de la cita.',
      );
    } finally {
      setClosingOutcome(null);
    }
  }

  const headerContact = sql
    ? [sql.lead.contacto_nombre, sql.lead.email]
        .filter((value) => typeof value === 'string' && value.length > 0)
        .join(' · ')
    : '';

  const loadInteractions = useCallback(() => {
    if (!id) return Promise.resolve([]);
    return fetchSqlInteractions(id);
  }, [id]);

  const register = useCallback(
    (payload: CreateInteractionPayload) => {
      if (!id) return Promise.reject(new Error('SQL no encontrado'));
      return registerSqlInteraction(id, payload);
    },
    [id],
  );

  return (
    <AppLayout title="Calificación">
      <QualificationNav />
      <Link to={back.to} className="mb-3 inline-block text-sm text-muted hover:text-ink">
        {back.label}
      </Link>

      {isLoading ? <p className="text-sm text-muted">Cargando…</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {sql ? (
        <>
          <section className={`${cardClass} mb-4 p-5`}>
            <p className="text-xs font-bold text-accent">{sqlAccentId(sql.sql_id)}</p>
            <h1 className="mt-1 text-lg font-bold text-ink">
              {String(sql.lead.empresa_nombre ?? sqlLeadName(sql.lead))}
            </h1>
            <p className="text-sm text-muted">{headerContact || 'Sin contacto'}</p>
          </section>

          <SqlDetailNav active={detailTab} onChange={setDetailTab} />

          {detailTab === 'interacciones' ? (
            <InteractionTimeline
              key={listVersion}
              leadId={id ?? sql.sql_id}
              leadName={String(sql.lead.empresa_nombre ?? sqlLeadName(sql.lead))}
              onRegistered={() => setListVersion((value) => value + 1)}
              readOnly={!canRegister}
              loadInteractions={loadInteractions}
              register={register}
              createReminder={
                id
                  ? (interactionId, payload) =>
                      createSqlInteractionReminder(id, interactionId, payload)
                  : undefined
              }
            />
          ) : (
            <>
            <div className="grid gap-4 lg:grid-cols-2">
              <section className={`${cardClass} p-5`}>
                <h2 className="mb-4 text-sm font-bold text-ink">Información del SQL</h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Estado</dt>
                    <dd className="font-bold text-ink">{sql.estado}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Vía de creación</dt>
                    <dd className="text-ink">
                      {sql.origen_creacion === 'directo_comercial' ? (
                        <span className="rounded bg-accent/10 px-1.5 py-0.5 text-xs font-bold text-accent">
                          Directo
                        </span>
                      ) : (
                        'Enrutamiento normal'
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Origen</dt>
                    <dd className="text-ink">{formatLeadOrigin(sql.lead.origen)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Canal de origen</dt>
                    <dd className="text-ink">
                      {formatLeadSourceChannel(sql.lead.canal_origen)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Contacto</dt>
                    <dd className="text-ink">{String(sql.lead.contacto_nombre ?? '—')}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Email</dt>
                    <dd className="text-ink">{String(sql.lead.email ?? '—')}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Creado</dt>
                    <dd className="text-ink">{formatDateTime(sql.fecha_creacion)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Asignado</dt>
                    <dd className="text-ink">{formatDateTime(sql.fecha_asignacion)}</dd>
                  </div>
                </dl>

                {canConvert ? (
                  <div className="mt-5">
                    <button
                      type="button"
                      className={primaryButtonClass}
                      onClick={() => setShowConvertModal(true)}
                    >
                      Crear OUV
                    </button>
                  </div>
                ) : null}

                {sql.estado === 'ConvertidoOUV' && sql.ouv ? (
                  <div className="mt-5 rounded border border-border bg-bg p-3 text-sm">
                    <p className="font-bold text-ink">
                      OUV asociada: {sql.ouv.consecutivo}
                    </p>
                    <Link
                      to={`/opportunities/${sql.ouv.ouv_id}`}
                      className="mt-2 inline-block text-sm font-bold text-accent hover:underline"
                    >
                      Abrir detalle de OUV →
                    </Link>
                  </div>
                ) : null}
              </section>

              <section className={`${cardClass} p-5`}>
                <h2 className="text-sm font-bold text-ink">Cita</h2>
                {sql.cita ? (
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">Estado</dt>
                      <dd className="font-bold text-ink">
                        {sql.cita.estado === 'Realizada'
                          ? 'Reunión ejecutada'
                          : sql.cita.estado === 'NoAsistio'
                            ? 'No asistieron'
                            : sql.cita.estado === 'Reagendada'
                              ? 'Reagendada'
                              : 'Agendada'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">Lugar</dt>
                      <dd className="text-ink">{sql.cita.lugar}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">Fecha</dt>
                      <dd className="text-ink">
                        {sql.cita.fecha} {sql.cita.hora}
                      </dd>
                    </div>
                    {sql.cita.teams_join_url ? (
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted">Teams</dt>
                        <dd>
                          <a
                            href={sql.cita.teams_join_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-accent hover:underline"
                          >
                            Unirse a la reunión
                          </a>
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">Contactos</dt>
                      <dd className="text-right text-ink">
                        {(
                          sql.cita.contactos ?? [
                            {
                              nombre: sql.cita.contacto_nombre,
                              email: sql.cita.contacto_email ?? '',
                              telefono: sql.cita.contacto_telefono ?? '',
                            },
                          ]
                        ).map((contacto) => (
                          <p key={`${contacto.nombre}-${contacto.email}`}>
                            {contacto.nombre}
                            {contacto.email ? ` · ${contacto.email}` : ''}
                            {contacto.telefono ? ` · ${contacto.telefono}` : ''}
                          </p>
                        ))}
                      </dd>
                    </div>
                  </dl>
                ) : needsAgencyCitaGeneration(sql) ? (
                  <div className="mt-3 space-y-2 text-sm text-ink">
                    <p>
                      Pendiente de generar en la bandeja de enrutamiento.
                      {sql.lead.fecha_cita
                        ? ` Indicada al aprobar el MQL: ${formatDateTime(String(sql.lead.fecha_cita))}.`
                        : ''}
                    </p>
                    <ul className="space-y-1">
                      {citaContactosFromLead(sql.lead).map((contacto) => (
                        <li key={`${contacto.nombre}-${contacto.email}`}>
                          {contacto.nombre}
                          {contacto.email ? ` · ${contacto.email}` : ''}
                          {contacto.telefono ? ` · ${contacto.telefono}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">Sin cita agendada.</p>
                )}
                {canCloseCita ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={primaryButtonClass}
                      disabled={closingOutcome !== null}
                      onClick={() => void handleCloseCita('Realizada')}
                    >
                      {closingOutcome === 'Realizada'
                        ? 'Guardando…'
                        : 'Se ejecutó la reunión'}
                    </button>
                    <button
                      type="button"
                      className={ghostButtonClass}
                      disabled={closingOutcome !== null}
                      onClick={() => void handleCloseCita('NoAsistio')}
                    >
                      {closingOutcome === 'NoAsistio'
                        ? 'Guardando…'
                        : 'No asistieron'}
                    </button>
                  </div>
                ) : null}
                {canScheduleNewCita ? (
                  <div className="mt-4">
                    <button
                      type="button"
                      className={primaryButtonClass}
                      onClick={() => setShowScheduleModal(true)}
                    >
                      Agendar nueva reunión
                    </button>
                  </div>
                ) : null}
              </section>
            </div>
            <div className="mt-4">
              <SqlCitaTraceCard sqlId={sql.sql_id} refreshKey={traceVersion} />
            </div>
            </>
          )}
        </>
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
      {showScheduleModal && sql ? (
        <AssignSqlModal
          sql={sql}
          scheduleOnly
          onClose={() => setShowScheduleModal(false)}
          onAssigned={() => {
            setShowScheduleModal(false);
            void loadSql();
            setTraceVersion((value) => value + 1);
          }}
          onVigenteConflict={() => void loadSql()}
        />
      ) : null}
    </AppLayout>
  );
}

export default SqlDetailPage;
