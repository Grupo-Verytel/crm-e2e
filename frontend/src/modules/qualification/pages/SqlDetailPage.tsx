import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppLayout } from '../../../layout/AppLayout';
import { formatDateTime } from '../../../lib/format';
import { fetchSql, type SqlDetail } from '../api/sqls-api';
import { QualificationNav } from '../components/QualificationNav';
import { cardClass, ghostButtonClass } from '../components/ui';

export function SqlDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [sql, setSql] = useState<SqlDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    </AppLayout>
  );
}

export default SqlDetailPage;
