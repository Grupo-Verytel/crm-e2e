import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../../layout/AppLayout';
import { Pagination } from '../../../components/Pagination';
import { formatDateTime } from '../../../lib/format';
import { useAuth } from '../../auth/hooks/useAuth';
import { discardLead, fetchLeads } from '../api/leads-api';
import { DemandNav } from '../components/DemandNav';
import { LeadFormModal } from '../components/LeadFormModal';
import { MotivoModal } from '../components/MotivoModal';
import { StatusBadge } from '../components/StatusBadge';
import { cardClass, ghostButtonClass, inputClass, labelClass, primaryButtonClass } from '../components/ui';
import {
  LEAD_ESTADOS,
  SEGMENTOS,
  type Lead,
  type LeadEstado,
  type Segmento,
} from '../types';

type Filters = {
  estado: LeadEstado | '';
  segmento: Segmento | '';
  responsable_id: string;
};

const emptyFilters: Filters = { estado: '', segmento: '', responsable_id: '' };

export function LeadsListPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Lead[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [showBulkDiscard, setShowBulkDiscard] = useState(false);

  const loadLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchLeads({
        page,
        limit,
        estado: applied.estado || undefined,
        segmento: applied.segmento || undefined,
        responsable_id: applied.responsable_id || undefined,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setError('No se pudieron cargar los leads.');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, applied]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on filter/page change
    void loadLeads();
  }, [loadLeads]);

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApplied(draft);
    setPage(1);
    setSelected(new Set());
  }

  function toggleSelected(leadId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  }

  async function handleBulkDiscard(motivo: string) {
    await Promise.all([...selected].map((leadId) => discardLead(leadId, motivo)));
    setSelected(new Set());
    await loadLeads();
  }

  return (
    <AppLayout title="Generación de demanda">
      <DemandNav />

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-ink">Leads</h1>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className={primaryButtonClass}
        >
          Nuevo lead
        </button>
      </div>

      <form
        onSubmit={handleFilterSubmit}
        className="mb-4 grid gap-3 rounded bg-surface p-4 shadow-card md:grid-cols-4"
      >
        <div>
          <label htmlFor="filter-estado" className={labelClass}>
            Estado
          </label>
          <select
            id="filter-estado"
            value={draft.estado}
            onChange={(event) =>
              setDraft({ ...draft, estado: event.target.value as LeadEstado | '' })
            }
            className={inputClass}
          >
            <option value="">Todos</option>
            {LEAD_ESTADOS.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-segmento" className={labelClass}>
            Segmento
          </label>
          <select
            id="filter-segmento"
            value={draft.segmento}
            onChange={(event) =>
              setDraft({ ...draft, segmento: event.target.value as Segmento | '' })
            }
            className={inputClass}
          >
            <option value="">Todos</option>
            {SEGMENTOS.map((segmento) => (
              <option key={segmento} value={segmento}>
                {segmento}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-responsable" className={labelClass}>
            Responsable (ID)
          </label>
          <input
            id="filter-responsable"
            value={draft.responsable_id}
            onChange={(event) =>
              setDraft({ ...draft, responsable_id: event.target.value })
            }
            className={inputClass}
          />
        </div>
        <div className="flex items-end">
          <button type="submit" className={primaryButtonClass}>
            Aplicar filtros
          </button>
        </div>
      </form>

      {selected.size > 0 ? (
        <div className="mb-3 flex items-center gap-3 rounded bg-surface px-4 py-2 shadow-card">
          <span className="text-sm text-muted">
            {selected.size} seleccionado{selected.size === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={() => setShowBulkDiscard(true)}
            className={ghostButtonClass}
          >
            Descartar seleccionados
          </button>
        </div>
      ) : null}

      <div className={cardClass}>
        {isLoading ? (
          <StateMessage>Cargando leads…</StateMessage>
        ) : error ? (
          <StateMessage>{error}</StateMessage>
        ) : items.length === 0 ? (
          <StateMessage>
            No hay leads con los filtros actuales. Crea el primero con “Nuevo lead”.
          </StateMessage>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3" />
                  <th className="px-4 py-3 font-bold">Empresa</th>
                  <th className="px-4 py-3 font-bold">Contacto</th>
                  <th className="px-4 py-3 font-bold">Segmento</th>
                  <th className="px-4 py-3 font-bold">Estado</th>
                  <th className="px-4 py-3 font-bold">Captura</th>
                </tr>
              </thead>
              <tbody>
                {items.map((lead) => (
                  <tr key={lead.lead_id} className="border-b border-border">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(lead.lead_id)}
                        onChange={() => toggleSelected(lead.lead_id)}
                        aria-label={`Seleccionar ${lead.empresa_nombre}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-bold text-ink">
                      <Link
                        to={`/demand/leads/${lead.lead_id}`}
                        className="hover:text-brand"
                      >
                        {lead.empresa_nombre}
                      </Link>
                      <div className="text-xs font-normal text-muted">{lead.email}</div>
                    </td>
                    <td className="px-4 py-3 text-ink">{lead.contacto_nombre}</td>
                    <td className="px-4 py-3 text-muted">{lead.segmento}</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={lead.estado} />
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatDateTime(lead.fecha_captura)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </div>

      {showCreate && user ? (
        <LeadFormModal
          responsableId={user.user_id}
          onCreated={() => {
            void loadLeads();
          }}
          onClose={() => setShowCreate(false)}
        />
      ) : null}

      {showBulkDiscard ? (
        <MotivoModal
          title={`Descartar ${selected.size} lead(s)`}
          confirmLabel="Descartar"
          onConfirm={handleBulkDiscard}
          onClose={() => setShowBulkDiscard(false)}
        />
      ) : null}
    </AppLayout>
  );
}

function StateMessage({ children }: { children: string }) {
  return <p className="px-6 py-10 text-center text-sm text-muted">{children}</p>;
}
