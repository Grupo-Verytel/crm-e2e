import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Pagination } from '../../../components/Pagination';
import { AppLayout } from '../../../layout/AppLayout';
import { useModuleSearch } from '../../../layout/useModuleSearch';
import { formatDateTime } from '../../../lib/format';
import { ApiError } from '../../auth/types';
import { useAuth } from '../../auth/hooks/useAuth';
import { fetchOuvs, type Ouv } from '../../discovery/api/ouvs-api';
import { WonCelebration } from '../../discovery/components/WonCelebration';
import {
  fetchWonSales,
  type WonSaleDto,
} from '../../offer-closing/api/won-sale-api';
import { ImplementationNav } from '../components/ImplementationNav';
import { cardClass } from '../components/ui';

const PAGE_SIZE = 20;

type Fila = { ouv: Ouv; expediente: WonSaleDto | null };

/**
 * Bandeja de implementación: solo las OUV ganadas cuyo proyecto ya se envió al
 * PMO. Las pendientes siguen en Oferta & Cierre. El avance real vive en el PMO.
 */
export function ServicesListPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // Llega desde /offers tras enviar el proyecto al PMO.
  const [celebrar, setCelebrar] = useState(
    () => (location.state as { celebrar?: boolean } | null)?.celebrar === true,
  );
  const { query } = useModuleSearch();
  const canListAll =
    user?.role_name === 'SoporteComercial' || user?.role_name === 'Admin';

  const [items, setItems] = useState<Fila[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Una búsqueda nueva vuelve a la primera página. Se ajusta en el render
  // (patrón de React para derivar estado de un cambio de prop), no en un efecto.
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setPage(1);
  }

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchOuvs({
        page,
        limit: PAGE_SIZE,
        resultado: 'Ganada',
        // Solo las que ya tienen proyecto en el PMO; el resto sigue en /offers.
        pmo_enviado: true,
        q: query || undefined,
        all: canListAll || undefined,
      });

      // SER, CP y fecha de envío viven en el expediente de la venta ganada.
      // Si ese API falla, la lista se muestra igual con los datos de la OUV.
      let expedientes: Record<string, WonSaleDto> = {};
      try {
        expedientes = await fetchWonSales(data.items.map((o) => o.ouv_id));
      } catch {
        expedientes = {};
      }

      setItems(
        data.items.map((ouv) => ({
          ouv,
          expediente: expedientes[ouv.ouv_id] ?? null,
        })),
      );
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
  }, [page, canListAll, query]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppLayout title="Implementación (SER)">
      <ImplementationNav />

      <div className="mb-4">
        <h1 className="text-xl font-bold text-ink">Servicios activos</h1>
        <p className="text-sm text-muted">
          Proyectos enviados a Control de Proyectos (PMO). Los indicadores de
          avance los calcula el PMO.
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
              <th className="px-4 py-3">SER</th>
              <th className="px-4 py-3">Proyecto</th>
              <th className="px-4 py-3">OUV origen</th>
              <th className="px-4 py-3">CP ID</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Enviado</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Cargando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  {query ? (
                    'No hay servicios que coincidan con la búsqueda.'
                  ) : (
                    <>
                      Todavía no hay proyectos enviados al PMO. Las ventas
                      ganadas pendientes están en{' '}
                      <Link to="/offers" className="text-accent hover:underline">
                        Oferta &amp; Cierre
                      </Link>
                      .
                    </>
                  )}
                </td>
              </tr>
            ) : (
              items.map(({ ouv, expediente }) => (
                <tr
                  key={ouv.ouv_id}
                  className="border-b border-border hover:bg-accent/5"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/services/${ouv.ouv_id}`}
                      className="font-bold text-accent hover:underline"
                    >
                      {expediente?.envioPmoSer ?? 'SER pendiente'}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {expediente?.nombreProyecto || ouv.titulo}
                  </td>
                  <td className="px-4 py-3 text-xs">{ouv.consecutivo}</td>
                  <td className="px-4 py-3 text-xs">
                    {expediente?.envioPmoConsecutivo ?? '—'}
                  </td>
                  <td className="px-4 py-3">{ouv.empresa_nombre}</td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {expediente?.envioPmoEnviadoEn
                      ? formatDateTime(expediente.envioPmoEnviadoEn)
                      : '—'}
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
      {celebrar ? (
        <WonCelebration
          onDone={() => {
            setCelebrar(false);
            // Sin el estado, recargar la página no repite la animación.
            navigate(location.pathname, { replace: true, state: null });
          }}
        />
      ) : null}
    </AppLayout>
  );
}

export default ServicesListPage;
