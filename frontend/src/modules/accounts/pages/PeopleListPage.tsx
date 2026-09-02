import { useCallback, useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { AppLayout } from '../../../layout/AppLayout';
import { Pagination } from '../../../components/Pagination';
import { fetchPeople } from '../api/accounts-api';
import { PersonFormModal } from '../components/PersonFormModal';
import type { Person } from '../types';
import { loadPersonInfluenciaTipo } from '../lib/person-influencia-extensions';
import {
  cardClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '../components/ui';

const LIMIT = 20;

export function PeopleListPage() {
  const [draftQ, setDraftQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Person | null | 'new'>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPeople({
        q: appliedQ || undefined,
        page,
        limit: LIMIT,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setError('No se pudo cargar el listado de contactos.');
    } finally {
      setLoading(false);
    }
  }, [appliedQ, page]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilters() {
    setAppliedQ(draftQ.trim());
    setPage(1);
  }

  return (
    <AppLayout title="Contactos">
      <div className={`${cardClass} mb-4 p-4`}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className={labelClass} htmlFor="people-q">
              Buscar
            </label>
            <input
              id="people-q"
              className={inputClass}
              value={draftQ}
              onChange={(e) => setDraftQ(e.target.value)}
              placeholder="Nombre, email o teléfono"
            />
          </div>
          <button type="button" className={primaryButtonClass} onClick={applyFilters}>
            Aplicar
          </button>
          <button type="button" className={primaryButtonClass} onClick={() => setEditing('new')}>
            Nuevo contacto
          </button>
        </div>
      </div>

      {error ? (
        <p className="mb-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className={cardClass}>
        {loading ? (
          <p className="p-4 text-sm text-muted">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-muted">No hay contactos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="px-4 py-3 font-bold">Nombre</th>
                  <th className="px-4 py-3 font-bold">Empresa</th>
                  <th className="px-4 py-3 font-bold">Influencia</th>
                  <th className="px-4 py-3 font-bold">Email</th>
                  <th className="px-4 py-3 font-bold">Teléfono</th>
                  <th className="px-4 py-3 font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.person_id} className="border-b border-border">
                    <td className="px-4 py-3 text-ink">{row.name}</td>
                    <td className="px-4 py-3 text-muted">
                      {row.account_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {loadPersonInfluenciaTipo(row.person_id) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted">{row.email ?? '—'}</td>
                    <td className="px-4 py-3 text-muted">{row.phone ?? '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="icon-btn grid h-9 w-9 place-items-center rounded"
                        aria-label={`Editar ${row.name}`}
                        onClick={() => setEditing(row)}
                      >
                        <Pencil size={16} strokeWidth={2} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination
        page={page}
        limit={LIMIT}
        total={total}
        onPageChange={setPage}
      />

      {editing ? (
        <PersonFormModal
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => void load()}
        />
      ) : null}
    </AppLayout>
  );
}

export default PeopleListPage;
