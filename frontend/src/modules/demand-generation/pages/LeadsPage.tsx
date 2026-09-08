import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Filter, LayoutGrid, List, Plus, Recycle, Upload } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '../../../layout/AppLayout';
import { useAuth } from '../../auth/hooks/useAuth';
import { fetchCampaigns } from '../api/campaigns-api';
import { fetchLeads } from '../api/leads-api';
import { DemandNav } from '../components/DemandNav';
import { FloatingToast } from '../components/FloatingToast';
import { LeadFormModal } from '../components/LeadFormModal';
import { GlobalLeadFilters } from '../components/leads/GlobalLeadFilters';
import {
  EMPTY_LEAD_FILTERS,
  countActiveLeadFilters,
  type LeadFilterValues,
} from '../lib/lead-filters';
import { LeadBulkImportModal } from '../components/leads/LeadBulkImportModal';
import { LeadsExceptionsView } from '../components/leads/LeadsExceptionsView';
import { LeadsKanbanView } from '../components/leads/LeadsKanbanView';
import { LeadsTableView } from '../components/leads/LeadsTableView';
import { useLeadsViewPreference } from '../hooks/useLeadsViewPreference';
import type { Lead, LeadFormMode, LeadsQuery } from '../types';

const LIST_LIMIT = 20;
const PRODUCT_MANAGER_ROLE = 'ProductManager';
const EJECUTIVO_ROLE = 'EjecutivoComercial';
const TRADUCTOR_ROLE = 'TraductorDeNegocio';
const DEVUELTAS_PARAM = 'bandeja';
const DEVUELTAS_VALUE = 'devueltas';

type CampaignOption = { campana_id: string; nombre: string };

function toQuery(filters: LeadFilterValues): Partial<LeadsQuery> {
  return {
    canal_origen: filters.canal_origen || undefined,
    segmento: filters.segmento || undefined,
    campana_id: filters.campana_id || undefined,
    responsable_id: filters.responsable_id || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  };
}

function resolveFormMode(roleName: string | undefined): LeadFormMode {
  if (roleName === PRODUCT_MANAGER_ROLE) {
    return 'product_manager';
  }
  if (roleName === EJECUTIVO_ROLE) {
    return 'ejecutivo';
  }
  return 'standard';
}

function canCreateLead(roleName: string | undefined): boolean {
  if (!roleName || roleName === TRADUCTOR_ROLE) {
    return false;
  }
  return (
    roleName === PRODUCT_MANAGER_ROLE ||
    roleName === EJECUTIVO_ROLE ||
    roleName === 'GestorMercadeo' ||
    roleName === 'DirectorMercadeo' ||
    roleName === 'Admin'
  );
}

export function LeadsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const roleName = user?.role_name;
  const isTraductor = roleName === TRADUCTOR_ROLE;
  const formMode = resolveFormMode(roleName);
  const showCreateButton = canCreateLead(roleName);

  const [view, setView] = useLeadsViewPreference();
  const showExceptions =
    !isTraductor && searchParams.get(DEVUELTAS_PARAM) === DEVUELTAS_VALUE;
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [draft, setDraft] = useState<LeadFilterValues>(EMPTY_LEAD_FILTERS);
  const [applied, setApplied] = useState<LeadFilterValues>(EMPTY_LEAD_FILTERS);
  const appliedKey = JSON.stringify(applied);
  const activeFilterCount = countActiveLeadFilters(applied);

  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [exceptionsCount, setExceptionsCount] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  const [items, setItems] = useState<Lead[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const hasLoadedListRef = useRef(false);

  const pageTitle = useMemo(() => {
    if (isTraductor) return 'Mis referidos';
    if (showExceptions) return 'Leads devueltas';
    return 'Bandeja Leads';
  }, [isTraductor, showExceptions]);

  const loadLeads = useCallback(async () => {
    if (!hasLoadedListRef.current) {
      setListLoading(true);
    }
    setListError(null);
    try {
      const data = await fetchLeads({
        ...toQuery(applied),
        page,
        limit: LIST_LIMIT,
      });
      setItems(data.items);
      setTotal(data.total);
      hasLoadedListRef.current = true;
    } catch {
      setListError('No se pudieron cargar los leads.');
    } finally {
      setListLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- appliedKey captures filters
  }, [appliedKey, page, refreshNonce]);

  const refreshExceptionsCount = useCallback(async () => {
    if (isTraductor) {
      setExceptionsCount(null);
      return;
    }
    try {
      const [reciclaje, descartado] = await Promise.all([
        fetchLeads({ ...toQuery(applied), estado: 'Reciclaje', page: 1, limit: 1 }),
        fetchLeads({ ...toQuery(applied), estado: 'Descartado', page: 1, limit: 1 }),
      ]);
      setExceptionsCount(reciclaje.total + descartado.total);
    } catch {
      setExceptionsCount(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- appliedKey captures filters
  }, [appliedKey, isTraductor]);

  useEffect(() => {
    if (view === 'list' && !showExceptions) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch
      void loadLeads();
    }
  }, [loadLeads, view, showExceptions]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch
    void refreshExceptionsCount();
  }, [refreshExceptionsCount]);

  useEffect(() => {
    if (isTraductor) {
      return;
    }
    let active = true;
    void fetchCampaigns({ page: 1, limit: 100 })
      .then((data) => {
        if (!active) {
          return;
        }
        setCampaigns(
          data.items.map((campaign) => ({
            campana_id: campaign.campana_id,
            nombre: campaign.nombre,
          })),
        );
      })
      .catch(() => {
        /* campaign filter is optional; ignore load failure */
      });
    return () => {
      active = false;
    };
  }, [isTraductor]);

  function handleApply() {
    setApplied(draft);
    setPage(1);
  }

  function handleClear() {
    setDraft(EMPTY_LEAD_FILTERS);
    setApplied(EMPTY_LEAD_FILTERS);
    setPage(1);
  }

  function exitDevueltas() {
    const next = new URLSearchParams(searchParams);
    next.delete(DEVUELTAS_PARAM);
    setSearchParams(next, { replace: true });
  }

  function handleSelectView(next: typeof view) {
    exitDevueltas();
    setView(next);
  }

  function handleToggleDevueltas() {
    if (showExceptions) {
      exitDevueltas();
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set(DEVUELTAS_PARAM, DEVUELTAS_VALUE);
    setSearchParams(next, { replace: true });
  }

  function showSuccessToast(message: string) {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 4000);
  }

  useEffect(
    () => () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    },
    [],
  );

  function handleLeadCreated(lead: Lead) {
    showSuccessToast('Lead creado exitosamente');
    setPage(1);
    setRefreshNonce((current) => current + 1);
    void refreshExceptionsCount();
    if (formMode === 'ejecutivo' && lead.estado === 'SQL') {
      navigate('/qualification/assigned');
    }
  }

  const viewToggleClass = (active: boolean) =>
    [
      'grid h-9 w-9 place-items-center rounded',
      active ? 'btn-glow text-white' : 'btn-glow-outline',
    ].join(' ');

  return (
    <AppLayout title="Leads">
      <DemandNav />

      {isTraductor ? (
        <p className="mb-3 rounded border border-border bg-bg px-3 py-2 text-sm text-ink">
          Mis referidos: tablero de seguimiento (solo lectura). No puedes cambiar
          estados ni mover leads entre bandejas.
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-ink">{pageTitle}</h1>

        {isTraductor ? null : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={viewToggleClass(!showExceptions && view === 'kanban')}
              onClick={() => handleSelectView('kanban')}
              aria-label="Vista Kanban"
              aria-pressed={!showExceptions && view === 'kanban'}
              title="Kanban"
            >
              <LayoutGrid size={18} strokeWidth={2} />
            </button>
            <button
              type="button"
              className={viewToggleClass(!showExceptions && view === 'list')}
              onClick={() => handleSelectView('list')}
              aria-label="Vista Lista"
              aria-pressed={!showExceptions && view === 'list'}
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
              aria-controls="leads-filters-panel"
              title="Filtros"
            >
              <Filter size={18} strokeWidth={2} />
              {activeFilterCount > 0 ? (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-0.5 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className={[viewToggleClass(showExceptions), 'relative'].join(' ')}
              onClick={handleToggleDevueltas}
              aria-label="Leads devueltas: reciclaje y descartados"
              aria-pressed={showExceptions}
              title="Leads devueltas"
            >
              <Recycle size={18} strokeWidth={2} />
              {exceptionsCount != null && exceptionsCount > 0 ? (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-0.5 text-[10px] font-bold text-white">
                  {exceptionsCount}
                </span>
              ) : null}
            </button>
            {!showExceptions ? (
              <button
                type="button"
                className={viewToggleClass(false)}
                onClick={() => setShowBulkImport(true)}
                aria-label="Carga masiva de leads"
                title="Carga masiva"
              >
                <Upload size={18} strokeWidth={2} />
              </button>
            ) : null}
            {showCreateButton && user ? (
              <button
                type="button"
                className={viewToggleClass(false)}
                onClick={() => setShowCreate(true)}
                aria-label={
                  formMode === 'ejecutivo' ? 'Nuevo lead directo' : 'Nuevo lead'
                }
                title={
                  formMode === 'ejecutivo' ? 'Nuevo lead directo' : 'Nuevo lead'
                }
              >
                <Plus size={18} strokeWidth={2} />
              </button>
            ) : null}
          </div>
        )}
      </div>

      {!isTraductor && filtersOpen ? (
        <div id="leads-filters-panel">
          <GlobalLeadFilters
            draft={draft}
            onChange={setDraft}
            onApply={handleApply}
            onClear={handleClear}
            campaigns={campaigns}
          />
        </div>
      ) : null}

      {showExceptions && !isTraductor ? (
        <LeadsExceptionsView
          filters={applied}
          onChanged={() => void refreshExceptionsCount()}
        />
      ) : !isTraductor && view === 'kanban' ? (
        <LeadsKanbanView filters={applied} refreshKey={refreshNonce} />
      ) : (
        <LeadsTableView
          leads={items}
          isLoading={listLoading}
          error={listError}
          page={page}
          limit={LIST_LIMIT}
          total={total}
          onPageChange={setPage}
          onReload={loadLeads}
          readOnly={isTraductor}
        />
      )}

      {showCreate && user ? (
        <LeadFormModal
          mode={formMode}
          responsableId={user.user_id}
          onCreated={handleLeadCreated}
          onClose={() => setShowCreate(false)}
        />
      ) : null}

      {showBulkImport ? (
        <LeadBulkImportModal
          onClose={() => setShowBulkImport(false)}
          onDone={() => {
            setRefreshNonce((current) => current + 1);
            void loadLeads();
            void refreshExceptionsCount();
          }}
        />
      ) : null}

      {toast ? (
        <FloatingToast
          message={toast}
          onDismiss={() => {
            if (toastTimerRef.current) {
              window.clearTimeout(toastTimerRef.current);
              toastTimerRef.current = null;
            }
            setToast(null);
          }}
        />
      ) : null}
    </AppLayout>
  );
}
