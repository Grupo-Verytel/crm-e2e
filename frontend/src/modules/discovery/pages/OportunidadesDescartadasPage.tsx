import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Filter, LayoutGrid, List } from 'lucide-react';
import { Pagination } from '../../../components/Pagination';
import { AppLayout } from '../../../layout/AppLayout';
import { formatDateTime } from '../../../lib/format';
import { useAuth } from '../../auth/hooks/useAuth';
import { fetchOuvs, type Ouv } from '../api/ouvs-api';
import { DiscoveryNav } from '../components/DiscoveryNav';
import { GapBadge, ZonaBadge } from '../components/OuvBadges';
import { OuvFiltersPanel } from '../components/OuvFiltersPanel';
import { cardClass } from '../components/ui';
import {
  countActiveOuvFilters,
  EMPTY_OUV_FILTERS,
  type DraftFilters,
} from '../lib/ouv-filters';
import { OUV_ZONA_LABEL, OUV_ZONAS, type OuvZona } from '../lib/ouv-vocab';

const PAGE_SIZE = 20;
const KANBAN_LIMIT = 30;

type ViewMode = 'lista' | 'kanban';

/** Bandeja de OUVs descartadas — mismo embudo, marco warning. */
export function OportunidadesDescartadasPage() {
  const { user } = useAuth();
  const canListAll =
    user?.role_name === 'SoporteComercial' || user?.role_name === 'Admin';

  const [view, setView] = useState<ViewMode>('kanban');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<DraftFilters>(EMPTY_OUV_FILTERS);
  const [applied, setApplied] = useState<DraftFilters>(EMPTY_OUV_FILTERS);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Ouv[]>([]);
  const [total, setTotal] = useState(0);
  const [kanban, setKanban] = useState<Record<OuvZona, Ouv[]>>({
    UNIVERSO: [],
    ENCIMA_FUNNEL: [],
    EN_FUNNEL: [],
    MAYOR_PROBABILIDAD: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeFilterCount = countActiveOuvFilters(applied);

  const queryBase = useCallback(() => {
    return {
      q: applied.q || undefined,
      zona: (applied.zona as OuvZona) || undefined,
      resultado: 'Descartada' as const,
      tiene_gap:
        applied.tiene_gap === ''
          ? undefined
          : applied.tiene_gap === 'true',
      created_from: applied.created_from || undefined,
      created_to: applied.created_to || undefined,
      all: canListAll || undefined,
    };
  }, [applied, canListAll]);

  const loadLista = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setIsLoading(true);
      setError(null);
      try {
        const data = await fetchOuvs({
          ...queryBase(),
          page,
          limit: PAGE_SIZE,
        });
        setItems(data.items);
        setTotal(data.total);
      } catch {
        setError('No se pudo cargar oportunidades descartadas.');
      } finally {
        if (!opts?.silent) setIsLoading(false);
      }
    },
    [page, queryBase],
  );

  const loadKanban = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setIsLoading(true);
      setError(null);
      try {
        const base = queryBase();
        const results = await Promise.all(
          OUV_ZONAS.map((zona) =>
            fetchOuvs({
              ...base,
              zona: base.zona || zona,
              page: 1,
              limit: KANBAN_LIMIT,
            }),
          ),
        );
        const next: Record<OuvZona, Ouv[]> = {
          UNIVERSO: [],
          ENCIMA_FUNNEL: [],
          EN_FUNNEL: [],
          MAYOR_PROBABILIDAD: [],
        };
        OUV_ZONAS.forEach((zona, i) => {
          next[zona] = base.zona && base.zona !== zona ? [] : results[i].items;
        });
        setKanban(next);
      } catch {
        setError('No se pudo cargar el kanban de oportunidades descartadas.');
      } finally {
        if (!opts?.silent) setIsLoading(false);
      }
    },
    [queryBase],
  );

  useEffect(() => {
    if (view === 'lista') void loadLista();
    else void loadKanban();
  }, [view, loadLista, loadKanban]);

  function handleApply() {
    setApplied(draft);
    setPage(1);
  }

  const viewToggleClass = (active: boolean) =>
    [
      'grid h-9 w-9 place-items-center rounded',
      active ? 'btn-glow text-white' : 'btn-glow-outline',
    ].join(' ');

  const discardedCardClass =
    'block rounded border-2 border-warning bg-bg p-2 hover:border-warning/80';

  return (
    <AppLayout title="Oportunidades descartadas">
      <DiscoveryNav />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">
            Oportunidades descartadas
          </h1>
          <p className="text-xs text-muted">
            OUVs en resultado Descartada, ubicadas en la zona del embudo donde
            se cerraron. El marco ámbar indica descarte.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={viewToggleClass(view === 'kanban')}
            onClick={() => setView('kanban')}
            aria-label="Vista Kanban"
            aria-pressed={view === 'kanban'}
            title="Kanban"
          >
            <LayoutGrid size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={viewToggleClass(view === 'lista')}
            onClick={() => setView('lista')}
            aria-label="Vista Lista"
            aria-pressed={view === 'lista'}
            title="Lista"
          >
            <List size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={[viewToggleClass(filtersOpen), 'relative'].join(' ')}
            onClick={() => setFiltersOpen((open) => !open)}
            aria-label="Mostrar filtros"
            aria-expanded={filtersOpen}
            title="Filtros"
          >
            <Filter size={18} strokeWidth={2} />
            {activeFilterCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-0.5 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      <div id="ouv-descartadas-filters">
        <OuvFiltersPanel
          open={filtersOpen}
          draft={draft}
          onDraftChange={setDraft}
          onApply={handleApply}
          onClear={() => {
            setDraft(EMPTY_OUV_FILTERS);
            setApplied(EMPTY_OUV_FILTERS);
            setPage(1);
          }}
        />
      </div>

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      {view === 'lista' ? (
        <>
          <div className={cardClass}>
            {isLoading ? (
              <p className="p-6 text-sm text-muted">Cargando…</p>
            ) : items.length === 0 ? (
              <p className="p-6 text-sm text-muted">
                No hay oportunidades descartadas.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs text-muted">
                  <tr>
                    <th className="px-4 py-3 font-bold">Consecutivo</th>
                    <th className="px-4 py-3 font-bold">Título</th>
                    <th className="px-4 py-3 font-bold">Empresa</th>
                    <th className="px-4 py-3 font-bold">Zona</th>
                    <th className="px-4 py-3 font-bold">Motivo</th>
                    <th className="px-4 py-3 font-bold">Cierre</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((ouv) => (
                    <tr
                      key={ouv.ouv_id}
                      className="border-b border-border border-l-4 border-l-warning"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/opportunities/${ouv.ouv_id}`}
                          className="font-bold text-accent hover:underline"
                        >
                          {ouv.consecutivo}
                        </Link>
                        {ouv.tiene_gap ? (
                          <span className="ml-2">
                            <GapBadge />
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-ink">{ouv.titulo}</td>
                      <td className="px-4 py-3 text-ink">
                        {ouv.empresa_nombre}
                      </td>
                      <td className="px-4 py-3">
                        <ZonaBadge zona={ouv.zona_actual} />
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {ouv.motivo_snapshot ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {ouv.fecha_cierre
                          ? formatDateTime(ouv.fecha_cierre)
                          : '—'}
                      </td>
                    </tr>
                  ))}
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
        </>
      ) : (
        <div className="grid gap-3 lg:grid-cols-4">
          {OUV_ZONAS.map((zona) => (
            <div key={zona} className={`${cardClass} min-h-64 p-3`}>
              <h2 className="mb-3 text-sm font-bold text-ink">
                {OUV_ZONA_LABEL[zona]}
              </h2>
              {isLoading ? (
                <p className="text-xs text-muted">Cargando…</p>
              ) : kanban[zona].length === 0 ? (
                <p className="text-xs text-muted">Vacío</p>
              ) : (
                <ul className="space-y-2">
                  {kanban[zona].map((ouv) => (
                    <li key={ouv.ouv_id}>
                      <Link
                        to={`/opportunities/${ouv.ouv_id}`}
                        className={discardedCardClass}
                      >
                        <p className="text-xs font-bold text-accent">
                          {ouv.consecutivo}
                        </p>
                        <p className="text-sm text-ink">{ouv.titulo}</p>
                        <p className="text-xs text-muted">
                          {ouv.empresa_nombre}
                        </p>
                        {ouv.motivo_snapshot ? (
                          <p className="mt-1 text-xs text-warning">
                            {ouv.motivo_snapshot}
                          </p>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}

export default OportunidadesDescartadasPage;
