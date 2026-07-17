import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatRelative } from '../../../../lib/format';
import { useAuth } from '../../../auth/hooks/useAuth';
import { fetchLeads, recycleLead } from '../../api/leads-api';
import type { Lead, LeadsQuery } from '../../types';
import { cardClass, ghostButtonClass } from '../ui';
import { StatusBadge } from '../StatusBadge';
import { SegmentChip } from './SegmentChip';
import type { LeadFilterValues } from '../../lib/lead-filters';

const PAGE_LIMIT = 50;
type ExceptionFilter = 'all' | 'Reciclaje' | 'Descartado';

const SUB_FILTERS: { value: ExceptionFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'Reciclaje', label: 'En reciclaje' },
  { value: 'Descartado', label: 'Descartadas' },
];

export function LeadsExceptionsView({
  filters,
  onChanged,
}: {
  filters: LeadFilterValues;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [subFilter, setSubFilter] = useState<ExceptionFilter>('all');
  const [items, setItems] = useState<Lead[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const baseQuery = useCallback(
    (estado: 'Reciclaje' | 'Descartado'): LeadsQuery => ({
      estado,
      canal_origen: filters.canal_origen || undefined,
      segmento: filters.segmento || undefined,
      campana_id: filters.campana_id || undefined,
      responsable_id: filters.responsable_id || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      page: 1,
      limit: PAGE_LIMIT,
    }),
    [filters],
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const estados: ('Reciclaje' | 'Descartado')[] =
        subFilter === 'all' ? ['Reciclaje', 'Descartado'] : [subFilter];
      const responses = await Promise.all(
        estados.map((estado) => fetchLeads(baseQuery(estado))),
      );
      const merged = responses
        .flatMap((response) => response.items)
        .sort(
          (a, b) =>
            new Date(b.fecha_captura).getTime() -
            new Date(a.fecha_captura).getTime(),
        );
      const total = responses.reduce((sum, response) => sum + response.total, 0);
      setItems(merged);
      setTruncated(total > merged.length);
    } catch {
      setError('No se pudieron cargar las excepciones.');
    } finally {
      setIsLoading(false);
    }
  }, [baseQuery, subFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on filter change
    void load();
  }, [load]);

  async function handleRecycle(lead: Lead) {
    if (!user) {
      return;
    }
    setBusyId(lead.lead_id);
    try {
      await recycleLead(lead.lead_id, user.user_id);
      await load();
      onChanged();
    } catch {
      setError('No se pudo reciclar el lead.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <p className="mr-2 text-sm text-muted">
          Estados de excepción — fuera del flujo normal del tablero.
        </p>
        <div className="inline-flex rounded border border-border p-0.5">
          {SUB_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSubFilter(option.value)}
              aria-pressed={subFilter === option.value}
              className={[
                'rounded-sm px-3 py-1 text-xs font-bold transition-colors',
                subFilter === option.value
                  ? 'bg-brand text-white'
                  : 'text-muted hover:text-ink',
              ].join(' ')}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <StateMessage>Cargando excepciones…</StateMessage>
      ) : error ? (
        <StateMessage>{error}</StateMessage>
      ) : items.length === 0 ? (
        <StateMessage>No hay leads en reciclaje ni descartados.</StateMessage>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-bold">Empresa / contacto</th>
                <th className="px-4 py-3 font-bold">Segmento</th>
                <th className="px-4 py-3 font-bold">Estado</th>
                <th className="px-4 py-3 font-bold">Motivo</th>
                <th className="px-4 py-3 font-bold">Última interacción</th>
                <th className="px-4 py-3 font-bold" />
              </tr>
            </thead>
            <tbody>
              {items.map((lead) => (
                <tr key={lead.lead_id} className="border-b border-border">
                  <td className="px-4 py-3">
                    <Link
                      to={`/demand/leads/${lead.lead_id}`}
                      className="font-bold text-ink hover:text-brand"
                    >
                      {lead.empresa_nombre}
                    </Link>
                    <div className="text-xs text-muted">{lead.contacto_nombre}</div>
                  </td>
                  <td className="px-4 py-3">
                    <SegmentChip segmento={lead.segmento} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={lead.estado} />
                  </td>
                  <td className="max-w-xs px-4 py-3 text-muted">
                    {lead.motivo_descarte ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {lead.fecha_ultima_interaccion
                      ? formatRelative(lead.fecha_ultima_interaccion)
                      : 'Sin interacción'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {lead.estado === 'Descartado' ? (
                      <button
                        type="button"
                        onClick={() => handleRecycle(lead)}
                        disabled={busyId === lead.lead_id}
                        className={ghostButtonClass}
                      >
                        Reciclar a nutrición
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {truncated ? (
        <p className="border-t border-border px-4 py-3 text-xs text-muted">
          Mostrando los primeros {PAGE_LIMIT} por estado. Acota con los filtros
          globales para ver el resto.
        </p>
      ) : null}
    </div>
  );
}

function StateMessage({ children }: { children: string }) {
  return <p className="px-6 py-10 text-center text-sm text-muted">{children}</p>;
}
