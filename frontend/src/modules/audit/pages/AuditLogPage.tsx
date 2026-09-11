import type { FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { AppLayout } from '../../../layout/AppLayout';
import { DatePickerField } from '../../../components/DatePickerField';
import { Pagination } from '../../../components/Pagination';
import { TimePickerField } from '../../../components/TimePickerField';
import { formatDateTime } from '../../../lib/format';
import { fetchAuditActors, fetchAuditLog } from '../api/audit-api';
import {
  AUDIT_ACTIONS,
  type AuditAction,
  type AuditActorOption,
  type AuditLogEntry,
  type AuditSortDirection,
  type AuditSortField,
} from '../types';

type AppliedFilters = {
  tabla: string;
  registroId: string;
  usuarioId: string;
  accion: AuditAction | '';
  fromDate: string;
  fromTime: string;
  toDate: string;
  toTime: string;
};

const emptyFilters: AppliedFilters = {
  tabla: '',
  registroId: '',
  usuarioId: '',
  accion: '',
  fromDate: '',
  fromTime: '',
  toDate: '',
  toTime: '',
};

function toFilterIso(
  date: string,
  time: string,
  fallbackTime: string,
): string | undefined {
  if (!date) return undefined;
  const parsed = new Date(`${date}T${time || fallbackTime}:00`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

const SORT_COLUMNS: { key: AuditSortField; label: string }[] = [
  { key: 'timestamp', label: 'Fecha' },
  { key: 'accion', label: 'Acción' },
  { key: 'tabla', label: 'Tabla' },
  { key: 'registro_id', label: 'Registro' },
  { key: 'campo_modificado', label: 'Campo' },
  { key: 'actor', label: 'Actor' },
  { key: 'ip_address', label: 'IP' },
];

export function AuditLogPage() {
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actors, setActors] = useState<AuditActorOption[]>([]);

  const [draft, setDraft] = useState<AppliedFilters>(emptyFilters);
  const [applied, setApplied] = useState<AppliedFilters>(emptyFilters);
  const [sortBy, setSortBy] = useState<AuditSortField>('timestamp');
  const [sortDir, setSortDir] = useState<AuditSortDirection>('DESC');

  const loadAuditLog = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchAuditLog({
        page,
        limit,
        tabla: applied.tabla || undefined,
        registro_id: applied.registroId || undefined,
        usuario_id: applied.usuarioId || undefined,
        accion: applied.accion || undefined,
        from: toFilterIso(applied.fromDate, applied.fromTime, '00:00'),
        to: toFilterIso(applied.toDate, applied.toTime, '23:59'),
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setError('No se pudo cargar el registro de auditoría.');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, applied, sortBy, sortDir]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on filter/page change
    void loadAuditLog();
  }, [loadAuditLog]);

  useEffect(() => {
    void fetchAuditActors()
      .then(setActors)
      .catch(() => {
        /* Keep the actor filter empty if users cannot be listed. */
      });
  }, []);

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApplied(draft);
    setPage(1);
  }

  function handleSort(column: AuditSortField) {
    if (sortBy === column) {
      setSortDir((current) => (current === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(column);
      setSortDir(column === 'timestamp' ? 'DESC' : 'ASC');
    }
    setPage(1);
  }

  return (
    <AppLayout title="Auditoría">
      <div className="space-y-4">
        <form
          onSubmit={handleFilterSubmit}
          className="grid gap-3 rounded bg-surface p-4 shadow-card md:grid-cols-3 lg:grid-cols-6"
        >
          <FilterField label="Tabla" id="filter-tabla">
            <input
              id="filter-tabla"
              value={draft.tabla}
              onChange={(event) => setDraft({ ...draft, tabla: event.target.value })}
              className={inputClass}
              placeholder="users"
            />
          </FilterField>

          <FilterField label="Registro ID" id="filter-registro">
            <input
              id="filter-registro"
              value={draft.registroId}
              onChange={(event) => setDraft({ ...draft, registroId: event.target.value })}
              className={inputClass}
            />
          </FilterField>

          <FilterField label="Actor" id="filter-usuario">
            <select
              id="filter-usuario"
              value={draft.usuarioId}
              onChange={(event) =>
                setDraft({ ...draft, usuarioId: event.target.value })
              }
              className={inputClass}
            >
              <option value="">Todos</option>
              {actors.map((actor) => (
                <option key={actor.user_id} value={actor.user_id}>
                  {actor.full_name}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Acción" id="filter-accion">
            <select
              id="filter-accion"
              value={draft.accion}
              onChange={(event) =>
                setDraft({ ...draft, accion: event.target.value as AuditAction | '' })
              }
              className={inputClass}
            >
              <option value="">Todas</option>
              {AUDIT_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Desde" id="filter-from" className="lg:col-span-2">
            <div className="grid grid-cols-[minmax(0,1fr)_6.75rem] gap-2">
              <DatePickerField
                id="filter-from"
                value={draft.fromDate}
                onChange={(fromDate) => setDraft({ ...draft, fromDate })}
                aria-label="Fecha desde"
              />
              <TimePickerField
                id="filter-from-time"
                value={draft.fromTime}
                onChange={(fromTime) => setDraft({ ...draft, fromTime })}
                aria-label="Hora desde"
              />
            </div>
          </FilterField>

          <FilterField label="Hasta" id="filter-to" className="lg:col-span-2">
            <div className="grid grid-cols-[minmax(0,1fr)_6.75rem] gap-2">
              <DatePickerField
                id="filter-to"
                value={draft.toDate}
                onChange={(toDate) => setDraft({ ...draft, toDate })}
                aria-label="Fecha hasta"
                align="end"
              />
              <TimePickerField
                id="filter-to-time"
                value={draft.toTime}
                onChange={(toTime) => setDraft({ ...draft, toTime })}
                aria-label="Hora hasta"
              />
            </div>
          </FilterField>

          <div className="md:col-span-3 lg:col-span-6">
            <button
              type="submit"
              className="btn-glow rounded px-4 py-2 text-sm font-bold text-white"
            >
              Aplicar filtros
            </button>
          </div>
        </form>

        <div className="rounded bg-surface shadow-card">
          {error ? (
            <StateMessage>{error}</StateMessage>
          ) : items.length === 0 && isLoading ? (
            <StateMessage>Cargando auditoría…</StateMessage>
          ) : items.length === 0 ? (
            <StateMessage>No hay registros con los filtros actuales.</StateMessage>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    {SORT_COLUMNS.map((column) => (
                      <SortableHeader
                        key={column.key}
                        label={column.label}
                        active={sortBy === column.key}
                        direction={sortDir}
                        onClick={() => handleSort(column.key)}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((entry) => (
                    <tr key={entry.audit_id} className="border-b border-border align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-muted">
                        {formatDateTime(entry.timestamp)}
                      </td>
                      <td className="px-4 py-3 font-bold text-ink">{entry.accion}</td>
                      <td className="px-4 py-3 text-ink">{entry.tabla}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">
                        {entry.registro_id.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-3 text-muted">
                        <p>{entry.campo_modificado ?? '—'}</p>
                        {entry.valor_anterior || entry.valor_nuevo ? (
                          <p className="mt-1 text-xs">
                            {entry.valor_anterior ?? '—'} → {entry.valor_nuevo ?? '—'}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-ink">
                        {entry.actor_nombre ?? `${entry.usuario_id.slice(0, 8)}…`}
                      </td>
                      <td className="px-4 py-3 text-muted">{entry.ip_address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
        </div>
      </div>
    </AppLayout>
  );
}

function SortableHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: AuditSortDirection;
  onClick: () => void;
}) {
  const SortIcon = !active
    ? ArrowUpDown
    : direction === 'ASC'
      ? ArrowUp
      : ArrowDown;

  return (
    <th className="px-4 py-3 font-bold" aria-sort={active ? (direction === 'ASC' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 text-left uppercase tracking-wide transition ${
          active ? 'text-accent' : 'text-muted hover:text-ink'
        }`}
      >
        {label}
        <SortIcon
          size={12}
          strokeWidth={2.5}
          className={active ? 'opacity-100' : 'opacity-40'}
        />
      </button>
    </th>
  );
}

function FilterField({
  label,
  id,
  className = '',
  children,
}: {
  label: string;
  id: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs font-bold text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}

function StateMessage({ children }: { children: string }) {
  return <p className="px-6 py-10 text-center text-sm text-muted">{children}</p>;
}

const inputClass =
  'h-9 w-full rounded border border-border bg-bg px-3 text-sm text-ink outline-none focus:border-accent focus:bg-surface';
