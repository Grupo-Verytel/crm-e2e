import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pagination } from '../../../components/Pagination';
import { AppLayout } from '../../../layout/AppLayout';
import { useModuleSearch } from '../../../layout/useModuleSearch';
import { fetchEjecutivosComerciales } from '../../discovery/api/catalogos-api';
import { canReadAllOuvs } from '../../discovery/lib/ouv-access';
import { useAuth } from '../../auth/hooks/useAuth';
import { fetchAssignedOuvs } from '../api/assigned-ouvs-api';
import { AssignedCommercialFiltersPanel } from '../components/AssignedCommercialFiltersPanel';
import type { CommercialOption } from '../components/AssignedCommercialFiltersPanel';
import { AssignedOuvsTable } from '../components/AssignedOuvsTable';
import { QualificationNav } from '../components/QualificationNav';
import type {
  AssignedOuvFilters,
  AssignedOuvItem,
} from '../types/assigned-ouvs.types';

const PAGE_SIZE = 20;

const EMPTY_FILTERS: AssignedOuvFilters = {
  comercial_id: '',
  follow_up_status: [],
};

export function AssignedOuvsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { query, setDraft } = useModuleSearch();
  const showCommercial = canReadAllOuvs(user?.role_name);
  const [items, setItems] = useState<AssignedOuvItem[]>([]);
  const [commercials, setCommercials] = useState<CommercialOption[]>([]);
  const [applied, setApplied] = useState<AssignedOuvFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const listKey = `${query}|${applied.comercial_id}|${applied.follow_up_status.join(',')}`;
  const [lastListKey, setLastListKey] = useState(listKey);
  if (listKey !== lastListKey) {
    setLastListKey(listKey);
    setPage(1);
  }
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAssignedOuvs({
        page,
        limit: PAGE_SIZE,
        comercial_id:
          showCommercial && applied.comercial_id
            ? applied.comercial_id
            : undefined,
        follow_up_status: applied.follow_up_status.length
          ? applied.follow_up_status
          : undefined,
        search: query || undefined,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setItems([]);
      setTotal(0);
      setError('No se pudo cargar las OUVs asignadas.');
    } finally {
      setIsLoading(false);
    }
  }, [applied, page, query, showCommercial]);

  useEffect(() => {
    if (!showCommercial) {
      return;
    }
    let cancelled = false;
    void fetchEjecutivosComerciales()
      .then((rows) => {
        if (!cancelled) {
          setCommercials(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCommercials([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [showCommercial]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on page change
    void load();
  }, [load]);

  const emptyLabel = query
    ? `Ninguna OUV coincide con “${query}”.`
    : 'No hay OUVs en curso asignadas';

  return (
    <AppLayout title="Calificación">
      <QualificationNav />
      <h1 className="mb-4 text-lg font-bold text-ink">OUVs Asignadas</h1>
      <AssignedCommercialFiltersPanel
        panelId="assigned-ouvs-filters-panel"
        commercials={commercials}
        applied={applied}
        showCommercial={showCommercial}
        onApply={(next) => {
          setApplied(
            showCommercial ? next : { ...next, comercial_id: '' },
          );
          setPage(1);
        }}
      />

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      {error ? null : (
        <>
          <AssignedOuvsTable
            items={items}
            loading={isLoading}
            emptyLabel={emptyLabel}
            onRowClick={(ouvId) => navigate(`/opportunities/${ouvId}`)}
          />
          {!isLoading && items.length === 0 && query ? (
            <button
              type="button"
              className="mt-3 text-sm font-bold text-accent hover:underline"
              onClick={() => setDraft('')}
            >
              Limpiar búsqueda
            </button>
          ) : null}
        </>
      )}

      <div className="mt-4">
        <Pagination
          page={page}
          total={total}
          limit={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>
    </AppLayout>
  );
}

export default AssignedOuvsPage;
