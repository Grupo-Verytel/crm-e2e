import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../../layout/AppLayout';
import { Pagination } from '../../../components/Pagination';
import { fetchCampaigns, updateCampaignStatus } from '../api/campaigns-api';
import { DemandNav } from '../components/DemandNav';
import { StatusBadge } from '../components/StatusBadge';
import { cardClass, inputClass, labelClass, primaryButtonClass } from '../components/ui';
import {
  CAMPAIGN_ESTADOS,
  CAMPAIGN_TIPOS,
  type Campaign,
  type CampaignEstado,
  type CampaignTipo,
} from '../types';

type Filters = { estado: CampaignEstado | ''; tipo: CampaignTipo | '' };
const emptyFilters: Filters = { estado: '', tipo: '' };

export function CampaignsListPage() {
  const [items, setItems] = useState<Campaign[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);

  const loadCampaigns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCampaigns({
        page,
        limit,
        estado: applied.estado || undefined,
        tipo: applied.tipo || undefined,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setError('No se pudieron cargar las campañas.');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, applied]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on filter/page change
    void loadCampaigns();
  }, [loadCampaigns]);

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApplied(draft);
    setPage(1);
  }

  async function handleStatusChange(campanaId: string, estado: CampaignEstado) {
    try {
      await updateCampaignStatus(campanaId, estado);
      await loadCampaigns();
    } catch {
      setError('No se pudo cambiar el estado de la campaña.');
    }
  }

  return (
    <AppLayout title="Generación de demanda">
      <DemandNav />

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-ink">Campañas</h1>
        <Link to="/demand/campaigns/new" className={primaryButtonClass}>
          Nueva campaña
        </Link>
      </div>

      <form
        onSubmit={handleFilterSubmit}
        className="mb-4 grid gap-3 rounded bg-surface p-4 shadow-card md:grid-cols-3"
      >
        <div>
          <label htmlFor="c-estado" className={labelClass}>
            Estado
          </label>
          <select
            id="c-estado"
            value={draft.estado}
            onChange={(event) =>
              setDraft({ ...draft, estado: event.target.value as CampaignEstado | '' })
            }
            className={inputClass}
          >
            <option value="">Todos</option>
            {CAMPAIGN_ESTADOS.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="c-tipo" className={labelClass}>
            Tipo
          </label>
          <select
            id="c-tipo"
            value={draft.tipo}
            onChange={(event) =>
              setDraft({ ...draft, tipo: event.target.value as CampaignTipo | '' })
            }
            className={inputClass}
          >
            <option value="">Todos</option>
            {CAMPAIGN_TIPOS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className={primaryButtonClass}>
            Aplicar filtros
          </button>
        </div>
      </form>

      <div className={cardClass}>
        {isLoading ? (
          <StateMessage>Cargando campañas…</StateMessage>
        ) : error ? (
          <StateMessage>{error}</StateMessage>
        ) : items.length === 0 ? (
          <StateMessage>No hay campañas. Crea la primera con “Nueva campaña”.</StateMessage>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-bold">Nombre</th>
                  <th className="px-4 py-3 font-bold">Tipo</th>
                  <th className="px-4 py-3 font-bold">Leads</th>
                  <th className="px-4 py-3 font-bold">CPL</th>
                  <th className="px-4 py-3 font-bold">Estado</th>
                  <th className="px-4 py-3 font-bold">Cambiar estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((campaign) => (
                  <tr key={campaign.campana_id} className="border-b border-border">
                    <td className="px-4 py-3 font-bold text-ink">{campaign.nombre}</td>
                    <td className="px-4 py-3 text-muted">{campaign.tipo}</td>
                    <td className="px-4 py-3 text-ink">{campaign.leads_generados}</td>
                    <td className="px-4 py-3 text-muted">{campaign.cpl ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={campaign.estado} />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={campaign.estado}
                        onChange={(event) =>
                          handleStatusChange(
                            campaign.campana_id,
                            event.target.value as CampaignEstado,
                          )
                        }
                        className={inputClass}
                        aria-label={`Estado de ${campaign.nombre}`}
                      >
                        {CAMPAIGN_ESTADOS.map((estado) => (
                          <option key={estado} value={estado}>
                            {estado}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </div>
    </AppLayout>
  );
}

function StateMessage({ children }: { children: string }) {
  return <p className="px-6 py-10 text-center text-sm text-muted">{children}</p>;
}
