import { Link } from 'react-router-dom';
import { formatDateTime } from '../../../lib/format';
import type { SqlDetail } from '../api/sqls-api';
import { cardClass, primaryButtonClass } from './ui';

type Props = {
  sql: SqlDetail;
  canConvert: boolean;
  onConvert: () => void;
};

export function SqlDetailInfoModule({ sql, canConvert, onConvert }: Props) {
  return (
    <section className={`${cardClass} flex h-full flex-col p-5`}>
      <h2 className="mb-4 text-sm font-bold text-ink">Información del SQL</h2>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Estado</dt>
          <dd className="font-bold text-ink">{sql.estado}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Origen</dt>
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
        <div className="mt-auto pt-5">
          <button type="button" className={primaryButtonClass} onClick={onConvert}>
            Crear OUV
          </button>
        </div>
      ) : null}

      {sql.estado === 'ConvertidoOUV' && sql.ouv ? (
        <div className="mt-5 rounded border border-border bg-bg p-3 text-sm">
          <p className="font-bold text-ink">OUV asociada: {sql.ouv.consecutivo}</p>
          <Link
            to={`/opportunities/${sql.ouv.ouv_id}`}
            className="mt-2 inline-block text-sm font-bold text-accent hover:underline"
          >
            Abrir detalle de OUV →
          </Link>
        </div>
      ) : null}
    </section>
  );
}
