import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  type LeadFilterValues,
} from '../lib/lead-filters';
import { LeadsExceptionsView } from '../components/leads/LeadsExceptionsView';
import { LeadsKanbanView } from '../components/leads/LeadsKanbanView';
import { LeadsTableView } from '../components/leads/LeadsTableView';
import { useLeadsViewPreference } from '../hooks/useLeadsViewPreference';
import { primaryButtonClass } from '../components/ui';
import type { Lead, LeadFormMode, LeadsQuery } from '../types';

const LIST_LIMIT = 20;
const PRODUCT_MANAGER_ROLE = 'ProductManager';
const EJECUTIVO_ROLE = 'EjecutivoComercial';
const TRADUCTOR_ROLE = 'TraductorDeNegocio';

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
  const { user } = useAuth();
  const roleName = user?.role_name;
  const isTraductor = roleName === TRADUCTOR_ROLE;
  const formMode = resolveFormMode(roleName);
  const showCreateButton = canCreateLead(roleName);

  const [view, setView] = useLeadsViewPreference();
  const [showExceptions, setShowExceptions] = useState(false);

  const [draft, setDraft] = useState<LeadFilterValues>(EMPTY_LEAD_FILTERS);
  const [applied, setApplied] = useState<LeadFilterValues>(EMPTY_LEAD_FILTERS);
  const appliedKey = JSON.stringify(applied);

  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [exceptionsCount, setExceptionsCount] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [items, setItems] = useState<Lead[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const hasLoadedListRef = useRef(false);

  const pageTitle = useMemo(
    () => (isTraductor ? 'Mis referidos' : 'Leads'),
    [isTraductor],
  );

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

  function handleSelectView(next: typeof view) {
    setShowExceptions(false);
    setView(next);
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

  return (
    <AppLayout title="Leads">
      <DemandNav
        actions={
          showCreateButton && user ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className={primaryButtonClass}
            >
              {formMode === 'ejecutivo' ? 'Nuevo lead directo' : 'Nuevo lead'}
            </button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold text-ink">{pageTitle}</h1>

        {!isTraductor ? (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <div
              className="inline-flex rounded border border-border bg-surface p-0.5"
              role="group"
              aria-label="Cambiar vista de leads"
            >
              <button
                type="button"
                onClick={() => handleSelectView('list')}
                aria-pressed={!showExceptions && view === 'list'}
                className={[
                  'inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-bold',
                  !showExceptions && view === 'list'
                    ? 'btn-glow'
                    : 'btn-glow-outline border-transparent',
                ].join(' ')}
              >
                <List size={15} strokeWidth={1.75} />
                Lista
              </button>
              <button
                type="button"
                onClick={() => handleSelectView('kanban')}
                aria-pressed={!showExceptions && view === 'kanban'}
                className={[
                  'inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-bold',
                  !showExceptions && view === 'kanban'
                    ? 'btn-glow'
                    : 'btn-glow-outline border-transparent',
                ].join(' ')}
              >
                <LayoutGrid size={15} strokeWidth={1.75} />
                Tablero
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowExceptions(true)}
              aria-pressed={showExceptions}
              className={[
                'rounded px-3 py-1.5 text-sm font-bold',
                showExceptions ? 'btn-glow' : 'btn-glow-outline',
              ].join(' ')}
            >
              Excepciones
              {exceptionsCount != null ? (
                <span className="ml-1.5 text-xs font-normal">
                  ({exceptionsCount})
                </span>
              ) : null}
            </button>
          </div>
        ) : null}
      </div>

      {isTraductor ? (
        <p className="mb-4 text-sm text-muted">
          Vista de solo lectura de los leads que referiste.
        </p>
      ) : (
        <GlobalLeadFilters
          draft={draft}
          onChange={setDraft}
          onApply={handleApply}
          onClear={handleClear}
          campaigns={campaigns}
        />
      )}

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
