import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pagination } from '../../../components/Pagination';
import { AppLayout } from '../../../layout/AppLayout';
import { formatDateTime } from '../../../lib/format';
import { ApiError } from '../../auth/types';
import { useAuth } from '../../auth/hooks/useAuth';
import { fetchOuvs, type Ouv } from '../../discovery/api/ouvs-api';
import { ImplementationNav } from '../components/ImplementationNav';
import { cardClass } from '../components/ui';

const PAGE_SIZE = 20;

function formatMonto(monto: string | null, moneda: string | null): string {
  if (!monto) return '—';
  const valor = new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(Number(monto));
  return moneda ? `${valor} ${moneda}` : valor;
}

/**
 * Bandeja de implementación: las OUV ganadas son las que tienen (o van a tener)
 * un proyecto en el PMO. El avance real vive en el PMO, no acá.
 */
export function ServicesListPage() {
  const { user } = useAuth();
  const canListAll =
    user?.role_name === 'SoporteComercial' || user?.role_name === 'Admin';

  const [items, setItems] = useState<Ouv[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchOuvs({
        page,
        limit: PAGE_SIZE,
        resultado: 'Ganada',
        all: canListAll || undefined,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudieron cargar los proyectos.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, canListAll]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppLayout title="Implementación (SER)">
      <ImplementationNav />

      <div className="mb-4">
        <h1 className="text-xl font-bold text-ink">Servicios activos</h1>
        <p className="text-sm text-muted">
          Oportunidades ganadas y su proyecto en el PMO (Control de Proyectos).
          Los indicadores de avance los calcula el PMO.
        </p>
      </div>

      {error ? (
        <p className="mb-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className={`${cardClass} overflow-x-auto p-0`}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th className="px-4 py-3">OUV</th>
              <th className="px-4 py-3">Proyecto</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Monto final</th>
              <th className="px-4 py-3">Cierre</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  Cargando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  Todavía no hay oportunidades ganadas. Cierra una en{' '}
                  <Link to="/opportunities" className="text-accent hover:underline">
                    Bandeja OUV
                  </Link>{' '}
                  para abrir su proyecto en el PMO.
                </td>
              </tr>
            ) : (
              items.map((ouv) => (
                <tr
                  key={ouv.ouv_id}
                  className="border-b border-border hover:bg-accent/5"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/services/${ouv.ouv_id}`}
                      className="font-bold text-accent hover:underline"
                    >
                      {ouv.consecutivo}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{ouv.titulo}</td>
                  <td className="px-4 py-3">{ouv.empresa_nombre}</td>
                  <td className="px-4 py-3">
                    {formatMonto(ouv.monto_final, ouv.moneda_final)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {formatDateTime(ouv.fecha_cierre)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <Pagination
          page={page}
          limit={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
        />
      </div>
    </AppLayout>
  );
}

export default ServicesListPage;
