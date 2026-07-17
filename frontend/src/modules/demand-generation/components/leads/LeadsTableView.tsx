import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pagination } from '../../../../components/Pagination';
import { formatDateTime, formatRelative } from '../../../../lib/format';
import { useAuth } from '../../../auth/hooks/useAuth';
import { reassignLead } from '../../api/leads-api';
import {
  needsChecklistProgress,
  useChecklistProgress,
} from '../../hooks/useChecklistProgress';
import { downloadLeadsCsv } from '../../lib/lead-export';
import { CANAL_ORIGEN_LABEL } from '../../lib/lead-vocab';
import type { Lead, LeadEstado } from '../../types';
import { cardClass, ghostButtonClass } from '../ui';
import { StatusBadge } from '../StatusBadge';
import { ChecklistProgress } from './ChecklistProgress';
import { ReassignModal } from './ReassignModal';
import { SegmentChip } from './SegmentChip';

type SortKey = 'captura' | 'ultima' | 'estado';
type SortDir = 'asc' | 'desc';

const ESTADO_ORDER: Record<LeadEstado, number> = {
  Nuevo: 0,
  TOFU: 1,
  MOFU: 2,
  MQL_PENDING: 3,
  SQL: 4,
  Reciclaje: 5,
  Descartado: 6,
};

function timeValue(value: string | null): number {
  return value ? new Date(value).getTime() : 0;
}

type Props = {
  leads: Lead[];
  isLoading: boolean;
  error: string | null;
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onReload: () => void | Promise<void>;
};

export function LeadsTableView({
  leads,
  isLoading,
  error,
  page,
  limit,
  total,
  onPageChange,
  onReload,
}: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const checklistProgress = useChecklistProgress(leads);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'captura',
    dir: 'desc',
  });
  const [showReassign, setShowReassign] = useState(false);
  const [bulkNote, setBulkNote] = useState<string | null>(null);

  const sortedLeads = useMemo(() => {
    const copy = [...leads];
    copy.sort((a, b) => {
      const diff =
        sort.key === 'captura'
          ? timeValue(a.fecha_captura) - timeValue(b.fecha_captura)
          : sort.key === 'ultima'
            ? timeValue(a.fecha_ultima_interaccion) -
              timeValue(b.fecha_ultima_interaccion)
            : ESTADO_ORDER[a.estado] - ESTADO_ORDER[b.estado];
      return sort.dir === 'asc' ? diff : -diff;
    });
    return copy;
  }, [leads, sort]);

  const allOnPageSelected =
    sortedLeads.length > 0 && sortedLeads.every((lead) => selected.has(lead.lead_id));

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'estado' ? 'asc' : 'desc' },
    );
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

  function toggleSelectAll() {
    setSelected((prev) => {
      if (sortedLeads.every((lead) => prev.has(lead.lead_id))) {
        const next = new Set(prev);
        sortedLeads.forEach((lead) => next.delete(lead.lead_id));
        return next;
      }
      const next = new Set(prev);
      sortedLeads.forEach((lead) => next.add(lead.lead_id));
      return next;
    });
  }

  const selectedLeads = leads.filter((lead) => selected.has(lead.lead_id));

  function handleExport() {
    downloadLeadsCsv(selectedLeads);
  }

  async function handleReassign(responsableId: string) {
    const results = await Promise.allSettled(
      selectedLeads.map((lead) => reassignLead(lead.lead_id, responsableId)),
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    const ok = results.length - failed;
    setBulkNote(
      failed > 0
        ? `Reasignados ${ok}; omitidos ${failed} (en aprobación o bloqueados).`
        : `Reasignados ${ok} lead(s).`,
    );
    setSelected(new Set());
    await onReload();
  }

  return (
    <>
      {selected.size > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded bg-surface px-4 py-2 shadow-card">
          <span className="text-sm font-bold text-ink">
            {selected.size} seleccionado{selected.size === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={() => setShowReassign(true)}
            className={ghostButtonClass}
          >
            Reasignar responsable
          </button>
          <button type="button" onClick={handleExport} className={ghostButtonClass}>
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-sm text-muted hover:text-ink"
          >
            Limpiar selección
          </button>
        </div>
      ) : null}

      {bulkNote ? (
        <p className="mb-3 text-sm text-muted" role="status">
          {bulkNote}
        </p>
      ) : null}

      <div className={cardClass}>
        {isLoading ? (
          <StateMessage>Cargando leads…</StateMessage>
        ) : error ? (
          <StateMessage>{error}</StateMessage>
        ) : sortedLeads.length === 0 ? (
          <StateMessage>
            No hay leads con los filtros actuales. Crea el primero con “Nuevo lead”.
          </StateMessage>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAll}
                      aria-label="Seleccionar todos los leads de la página"
                    />
                  </th>
                  <th className="px-4 py-3 font-bold">Empresa / contacto</th>
                  <th className="px-4 py-3 font-bold">Segmento</th>
                  <th className="px-4 py-3 font-bold">Canal</th>
                  <SortableHeader
                    label="Estado"
                    active={sort.key === 'estado'}
                    dir={sort.dir}
                    onClick={() => toggleSort('estado')}
                  />
                  <th className="px-4 py-3 font-bold">Campaña</th>
                  <th className="px-4 py-3 font-bold">Responsable</th>
                  <SortableHeader
                    label="Última interacción"
                    active={sort.key === 'ultima'}
                    dir={sort.dir}
                    onClick={() => toggleSort('ultima')}
                  />
                  <th className="px-4 py-3 font-bold">Checklist</th>
                  <SortableHeader
                    label="Captura"
                    active={sort.key === 'captura'}
                    dir={sort.dir}
                    onClick={() => toggleSort('captura')}
                  />
                </tr>
              </thead>
              <tbody>
                {sortedLeads.map((lead) => (
                  <tr
                    key={lead.lead_id}
                    onClick={() => navigate(`/demand/leads/${lead.lead_id}`)}
                    className="cursor-pointer border-b border-border hover:bg-bg"
                  >
                    <td
                      className="px-4 py-3"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(lead.lead_id)}
                        onChange={() => toggleSelected(lead.lead_id)}
                        aria-label={`Seleccionar ${lead.empresa_nombre}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/demand/leads/${lead.lead_id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="font-bold text-ink hover:text-brand"
                      >
                        {lead.empresa_nombre}
                      </Link>
                      <div className="text-xs text-muted">{lead.contacto_nombre}</div>
                    </td>
                    <td className="px-4 py-3">
                      <SegmentChip segmento={lead.segmento} />
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {CANAL_ORIGEN_LABEL[lead.canal_origen]}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={lead.estado} />
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {lead.campana_id ? (
                        <span title={lead.campana_id}>
                          {lead.utm_campaign ?? 'Campaña asociada'}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      <Responsable
                        responsableId={lead.responsable_id}
                        currentUserId={user?.user_id}
                      />
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {lead.fecha_ultima_interaccion ? (
                        <span title={formatDateTime(lead.fecha_ultima_interaccion)}>
                          {formatRelative(lead.fecha_ultima_interaccion)}
                        </span>
                      ) : (
                        <span className="text-muted">Sin interacción</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ChecklistProgress
                        progress={
                          needsChecklistProgress(lead)
                            ? checklistProgress(lead.lead_id)
                            : null
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-muted">
                      <span title={formatDateTime(lead.fecha_captura)}>
                        {formatRelative(lead.fecha_captura)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={page}
          limit={limit}
          total={total}
          onPageChange={onPageChange}
        />
      </div>

      {showReassign ? (
        <ReassignModal
          count={selected.size}
          onConfirm={handleReassign}
          onClose={() => setShowReassign(false)}
        />
      ) : null}
    </>
  );
}

function SortableHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <th className="px-4 py-3 font-bold">
      <button
        type="button"
        onClick={onClick}
        aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`inline-flex items-center gap-1 uppercase tracking-wide ${
          active ? 'text-ink' : 'text-muted hover:text-ink'
        }`}
      >
        {label}
        <span aria-hidden="true" className="text-[10px]">
          {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}

function Responsable({
  responsableId,
  currentUserId,
}: {
  responsableId: string;
  currentUserId: string | undefined;
}) {
  if (currentUserId && responsableId === currentUserId) {
    return <span className="text-ink">Tú</span>;
  }
  return <span title={responsableId}>{responsableId.slice(0, 8)}…</span>;
}

function StateMessage({ children }: { children: string }) {
  return <p className="px-6 py-10 text-center text-sm text-muted">{children}</p>;
}
