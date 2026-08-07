import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppLayout } from '../../../layout/AppLayout';
import { formatDateTime } from '../../../lib/format';
import { useAuth } from '../../auth/hooks/useAuth';
import { fetchSql, type SqlDetail } from '../api/sqls-api';
import { ConvertirSqlEnOuvModal } from '../components/ConvertirSqlEnOuvModal';
import { QualificationNav } from '../components/QualificationNav';
import {
  cardClass,
  ghostButtonClass,
  primaryButtonClass,
} from '../components/ui';

export function SqlDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [sql, setSql] = useState<SqlDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showConvertModal, setShowConvertModal] = useState(false);

  async function loadSql(sqlId: string) {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSql(sqlId);
      setSql(data);
    } catch {
      setError('No se pudo cargar el SQL.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchSql(id!);
        if (!cancelled) {
          setSql(data);
        }
      } catch {
        if (!cancelled) {
          setError('No se pudo cargar el SQL.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!successToast) {
      return;
    }
    const timer = window.setTimeout(() => setSuccessToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [successToast]);

  const canConvert =
    user?.role_name === 'EjecutivoComercial' &&
    sql?.estado === 'Asignado' &&
    sql.comercial_asignado_id === user.user_id;

  return (
    <AppLayout title="Calificación">
      <QualificationNav />
      <div className="mb-4">
        <Link to="/qualification" className={`${ghostButtonClass} inline-block`}>
          ← Volver
        </Link>
      </div>

      {isLoading ? <p className="text-sm text-muted">Cargando…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {sql ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className={`${cardClass} p-5`}>
            <h1 className="text-lg font-bold text-ink">
              {String(sql.lead.empresa_nombre ?? 'SQL')}
            </h1>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Estado</dt>
                <dd className="font-bold text-ink">{sql.estado}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Contacto</dt>
                <dd className="text-ink">
                  {String(sql.lead.contacto_nombre ?? '—')}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Email</dt>
                <dd className="text-ink">{String(sql.lead.email ?? '—')}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Creado</dt>
                <dd className="text-ink">
                  {formatDateTime(sql.fecha_creacion)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Asignado</dt>
                <dd className="text-ink">
                  {formatDateTime(sql.fecha_asignacion)}
                </dd>
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
                <p className="mt-1 text-muted">
                  Vista de detalle de OUV aún no disponible.
                </p>
              </div>
            ) : null}
          </section>

          <section className={`${cardClass} p-5`}>
            <h2 className="text-sm font-bold text-ink">Cita</h2>
            {sql.cita ? (
              <dl className="mt-3 space-y-2 text-sm">
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
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Contacto</dt>
                  <dd className="text-ink">{sql.cita.contacto_nombre}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-muted">Sin cita agendada.</p>
            )}
          </section>
        </div>
      ) : null}

      {showConvertModal && sql ? (
        <ConvertirSqlEnOuvModal
          sql={sql}
          onClose={() => setShowConvertModal(false)}
          onConverted={(consecutivo) => {
            setSuccessToast(`OUV ${consecutivo} creada correctamente.`);
            if (id) {
              void loadSql(id);
            }
          }}
        />
      ) : null}

      {successToast ? (
        <div
          className="fixed bottom-4 right-4 z-50 w-80 rounded border border-border bg-surface p-4 shadow-card"
          role="status"
        >
          <p className="text-sm font-bold text-ink">Conversión exitosa</p>
          <p className="mt-1 text-sm text-muted">{successToast}</p>
        </div>
      ) : null}
    </AppLayout>
  );
}

export default SqlDetailPage;
