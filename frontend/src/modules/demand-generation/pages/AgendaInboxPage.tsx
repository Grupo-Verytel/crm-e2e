import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Pagination } from '../../../components/Pagination';
import { AppLayout } from '../../../layout/AppLayout';
import { fetchLeads } from '../api/leads-api';
import { DemandNav } from '../components/DemandNav';
import { RegisterAppointmentModal } from '../components/leads/RegisterAppointmentModal';
import {
  cardClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '../components/ui';
import type { Lead } from '../types';

const PAGE_SIZE = 20;

function daysSince(date: string): number {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000),
  );
}

export function AgendaInboxPage() {
  const [items, setItems] = useState<Lead[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [responsibleDraft, setResponsibleDraft] = useState('');
  const [responsible, setResponsible] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Lead | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchLeads({
        estado: 'MOFU',
        canal_origen: 'GENERACION_DEMANDA_AGENCIA',
        responsable_id: responsible || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setError('No se pudo cargar la Bandeja de Agenda.');
    } finally {
      setIsLoading(false);
    }
  }, [page, responsible]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on filter/page change
    void load();
  }, [load]);

  function applyFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setResponsible(responsibleDraft.trim());
  }

  return (
    <AppLayout title="Bandeja de Agenda">
      <DemandNav />
      <h1 className="mb-4 text-lg font-bold text-ink">Bandeja de Agenda</h1>

      <form
        onSubmit={applyFilter}
        className="mb-4 flex items-end gap-2 rounded bg-surface p-4 shadow-card"
      >
        <div className="min-w-72">
          <label htmlFor="agenda-responsible" className={labelClass}>
            Responsable (ID)
          </label>
          <input
            id="agenda-responsible"
            value={responsibleDraft}
            onChange={(event) => setResponsibleDraft(event.target.value)}
            className={inputClass}
            placeholder="Filtrar por responsable"
          />
        </div>
        <button type="submit" className={primaryButtonClass}>
          Aplicar filtro
        </button>
      </form>

      <div className={cardClass}>
        {isLoading ? (
          <StateMessage>Cargando agenda…</StateMessage>
        ) : error ? (
          <StateMessage>{error}</StateMessage>
        ) : items.length === 0 ? (
          <StateMessage>No hay leads pendientes de agendar.</StateMessage>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-bg text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Días en MOFU</th>
                  <th className="px-4 py-3">Responsable</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((lead) => (
                  <tr key={lead.lead_id}>
                    <td className="px-4 py-3">
                      <Link
                        to={`/demand/leads/${lead.lead_id}`}
                        className="font-bold text-ink hover:text-brand"
                      >
                        {lead.contacto_nombre}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {lead.empresa_nombre}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {daysSince(lead.fecha_captura)}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {lead.responsable_nombre ?? lead.responsable_id}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(lead)}
                        className={primaryButtonClass}
                      >
                        Registrar Cita Agendada
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={page}
          limit={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
        />
      </div>

      {selected ? (
        <RegisterAppointmentModal
          lead={selected}
          onRegistered={() => void load()}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </AppLayout>
  );
}

function StateMessage({ children }: { children: string }) {
  return <p className="px-6 py-10 text-center text-sm text-muted">{children}</p>;
}
