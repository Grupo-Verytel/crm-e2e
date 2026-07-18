import { useCallback, useEffect, useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { AppLayout } from '../../../layout/AppLayout';
import { useAuth } from '../../auth/hooks/useAuth';
import { fetchCampaigns } from '../api/campaigns-api';
import { fetchLeads } from '../api/leads-api';
import { DemandNav } from '../components/DemandNav';
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
import type { Lead, LeadsQuery } from '../types';

const LIST_LIMIT = 20;

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

export function LeadsPage() {
  const { user } = useAuth();
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

  const loadLeads = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const data = await fetchLeads({
        ...toQuery(applied),
        page,
        limit: LIST_LIMIT,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setListError('No se pudieron cargar los leads.');
    } finally {
      setListLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- appliedKey captures filters
  }, [appliedKey, page]);

  const refreshExceptionsCount = useCallback(async () => {
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
  }, [appliedKey]);

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
  }, []);

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

  return (
    <AppLayout title="Generación de demanda">
      <DemandNav
        actions={
          user ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className={primaryButtonClass}
            >
              Nuevo lead
            </button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold text-ink">Leads</h1>

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
                'inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-bold transition-colors',
                !showExceptions && view === 'list'
                  ? 'bg-brand text-white'
                  : 'text-muted hover:text-ink',
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
                'inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-bold transition-colors',
                !showExceptions && view === 'kanban'
                  ? 'bg-brand text-white'
                  : 'text-muted hover:text-ink',
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
              'rounded border px-3 py-1.5 text-sm font-bold transition-colors',
              showExceptions
                ? 'border-warning bg-surface text-warning'
                : 'border-border bg-surface text-muted hover:text-ink',
            ].join(' ')}
          >
            Excepciones
            {exceptionsCount != null ? (
              <span className="ml-1.5 text-xs font-normal">({exceptionsCount})</span>
            ) : null}
          </button>
        </div>
      </div>

      <GlobalLeadFilters
        draft={draft}
        onChange={setDraft}
        onApply={handleApply}
        onClear={handleClear}
        campaigns={campaigns}
      />

      {showExceptions ? (
        <LeadsExceptionsView
          filters={applied}
          onChanged={() => void refreshExceptionsCount()}
        />
      ) : view === 'kanban' ? (
        <LeadsKanbanView filters={applied} />
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
        />
      )}

      {showCreate && user ? (
        <LeadFormModal
          responsableId={user.user_id}
          onCreated={() => {
            void loadLeads();
            void refreshExceptionsCount();
          }}
          onClose={() => setShowCreate(false)}
        />
      ) : null}
    </AppLayout>
  );
}
