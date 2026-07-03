import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../../layout/AppLayout';
import { Pagination } from '../../../components/Pagination';
import { formatDateTime } from '../../../lib/format';
import { fetchLead } from '../api/leads-api';
import { approveMql, fetchMqls, rejectMql } from '../api/mqls-api';
import { DemandNav } from '../components/DemandNav';
import { MotivoModal } from '../components/MotivoModal';
import { cardClass, ghostButtonClass, primaryButtonClass } from '../components/ui';
import type { Lead, Mql } from '../types';

export function MqlInboxPage() {
  const [items, setItems] = useState<Mql[]>([]);
  const [leads, setLeads] = useState<Record<string, Lead>>({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Mql | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadMqls = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchMqls({ estado: 'Activo', page, limit });
      setItems(data.items);
      setTotal(data.total);

      const uniqueLeadIds = [...new Set(data.items.map((mql) => mql.lead_id))];
      const resolved = await Promise.all(
        uniqueLeadIds.map((leadId) => fetchLead(leadId).catch(() => null)),
      );
      const map: Record<string, Lead> = {};
      resolved.forEach((lead) => {
        if (lead) map[lead.lead_id] = lead;
      });
      setLeads(map);
    } catch {
      setError('No se pudieron cargar los MQL pendientes.');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on page change
    void loadMqls();
  }, [loadMqls]);

  async function handleApprove(mql: Mql) {
    setBusyId(mql.mql_id);
    setError(null);
    try {
      await approveMql(mql.mql_id);
      await loadMqls();
    } catch {
      setError('No se pudo aprobar el MQL.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppLayout title="Bandeja de MQL">
      <DemandNav />

      <h1 className="mb-4 text-lg font-bold text-ink">MQL pendientes de aprobación</h1>

      <div className={cardClass}>
        {isLoading ? (
          <StateMessage>Cargando MQL…</StateMessage>
        ) : error ? (
          <StateMessage>{error}</StateMessage>
        ) : items.length === 0 ? (
          <StateMessage>No hay MQL pendientes de revisión.</StateMessage>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((mql) => {
              const lead = leads[mql.lead_id];
              return (
                <li
                  key={mql.mql_id}
                  className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-ink">
                      {lead ? (
                        <Link
                          to={`/demand/leads/${lead.lead_id}`}
                          className="hover:text-brand"
                        >
                          {lead.empresa_nombre}
                        </Link>
                      ) : (
                        mql.lead_id
                      )}
                    </p>
                    <p className="text-sm text-muted">
                      {lead ? `${lead.contacto_nombre} · ${lead.segmento}` : '—'} ·
                      calificado {formatDateTime(mql.fecha_calificacion)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busyId === mql.mql_id}
                      onClick={() => handleApprove(mql)}
                      className={primaryButtonClass}
                    >
                      Aprobar → SQL
                    </button>
                    <button
                      type="button"
                      disabled={busyId === mql.mql_id}
                      onClick={() => setRejecting(mql)}
                      className={ghostButtonClass}
                    >
                      Rechazar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </div>

      {rejecting ? (
        <MotivoModal
          title="Rechazar MQL"
          confirmLabel="Rechazar"
          onConfirm={async (motivo) => {
            await rejectMql(rejecting.mql_id, motivo);
            await loadMqls();
          }}
          onClose={() => setRejecting(null)}
        />
      ) : null}
    </AppLayout>
  );
}

function StateMessage({ children }: { children: string }) {
  return <p className="px-6 py-10 text-center text-sm text-muted">{children}</p>;
}
