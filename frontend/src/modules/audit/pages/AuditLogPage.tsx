import type { FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '../../../layout/AppLayout';
import { Pagination } from '../../../components/Pagination';
import { formatDateTime } from '../../../lib/format';
import { fetchAuditLog } from '../api/audit-api';
import { AUDIT_ACTIONS, type AuditAction, type AuditLogEntry } from '../types';

type AppliedFilters = {
  tabla: string;
  registroId: string;
  usuarioId: string;
  accion: AuditAction | '';
  from: string;
  to: string;
};

const emptyFilters: AppliedFilters = {
  tabla: '',
  registroId: '',
  usuarioId: '',
  accion: '',
  from: '',
  to: '',
};

export function AuditLogPage() {
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<AppliedFilters>(emptyFilters);
  const [applied, setApplied] = useState<AppliedFilters>(emptyFilters);

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
        from: applied.from ? new Date(applied.from).toISOString() : undefined,
        to: applied.to ? new Date(applied.to).toISOString() : undefined,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setError('No se pudo cargar el registro de auditoría.');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, applied]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on filter/page change
    void loadAuditLog();
  }, [loadAuditLog]);

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApplied(draft);
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

          <FilterField label="Usuario ID" id="filter-usuario">
            <input
              id="filter-usuario"
              value={draft.usuarioId}
              onChange={(event) => setDraft({ ...draft, usuarioId: event.target.value })}
              className={inputClass}
            />
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

          <FilterField label="Desde" id="filter-from">
            <input
              id="filter-from"
              type="datetime-local"
              value={draft.from}
              onChange={(event) => setDraft({ ...draft, from: event.target.value })}
              className={inputClass}
            />
          </FilterField>

          <FilterField label="Hasta" id="filter-to">
            <input
              id="filter-to"
              type="datetime-local"
              value={draft.to}
              onChange={(event) => setDraft({ ...draft, to: event.target.value })}
              className={inputClass}
            />
          </FilterField>

          <div className="md:col-span-3 lg:col-span-6">
            <button
              type="submit"
              className="rounded bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-700"
            >
              Aplicar filtros
            </button>
          </div>
        </form>

        <div className="rounded bg-surface shadow-card">
          {isLoading ? (
            <StateMessage>Cargando auditoría…</StateMessage>
          ) : error ? (
            <StateMessage>{error}</StateMessage>
          ) : items.length === 0 ? (
            <StateMessage>No hay registros con los filtros actuales.</StateMessage>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3 font-bold">Fecha</th>
                    <th className="px-4 py-3 font-bold">Acción</th>
                    <th className="px-4 py-3 font-bold">Tabla</th>
                    <th className="px-4 py-3 font-bold">Registro</th>
                    <th className="px-4 py-3 font-bold">Campo</th>
                    <th className="px-4 py-3 font-bold">Actor</th>
                    <th className="px-4 py-3 font-bold">IP</th>
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
                        {entry.campo_modificado ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">
                        {entry.usuario_id.slice(0, 8)}…
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

function FilterField({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div>
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
  'h-9 w-full rounded border border-border bg-bg px-3 text-sm text-ink outline-none focus:border-brand focus:bg-surface';
