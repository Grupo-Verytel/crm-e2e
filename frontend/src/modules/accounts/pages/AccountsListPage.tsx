import { useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2, Users } from 'lucide-react';
import { AppLayout } from '../../../layout/AppLayout';
import { Pagination } from '../../../components/Pagination';
import { useModuleSearch } from '../../../layout/module-search';
import { useAuth } from '../../auth/hooks/useAuth';
import { ApiError } from '../../auth/types';
import { deleteAccount, fetchAccounts } from '../api/accounts-api';
import { AccountFormModal } from '../components/AccountFormModal';
import { AccountPeopleModal } from '../components/AccountPeopleModal';
import type { Account } from '../types';
import { cardClass, primaryButtonClass } from '../components/ui';

const LIMIT = 20;

export function AccountsListPage() {
  const { user } = useAuth();
  const { query } = useModuleSearch();
  const canDelete = Boolean(
    user?.permissions?.some(
      (p) => p.action === 'delete' && p.subject === 'Account',
    ),
  );

  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Account | null | 'new'>(null);
  const [viewingPeople, setViewingPeople] = useState<Account | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAccounts({
        q: query || undefined,
        page,
        limit: LIMIT,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setError('No se pudo cargar el listado de empresas.');
    } finally {
      setLoading(false);
    }
  }, [query, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  async function onDelete(row: Account) {
    if (!window.confirm(`¿Eliminar la empresa "${row.name}"?`)) return;
    setError(null);
    try {
      await deleteAccount(row.account_id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar.');
    }
  }

  return (
    <AppLayout title="Empresas">
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => setEditing('new')}
        >
          Nueva empresa
        </button>
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
          <p className="p-4 text-sm text-muted">
            {query ? 'No hay empresas que coincidan con la búsqueda.' : 'No hay empresas.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="px-4 py-3 font-bold">Nombre</th>
                  <th className="px-4 py-3 font-bold">NIT</th>
                  <th className="px-4 py-3 font-bold">Sector económico</th>
                  <th className="px-4 py-3 font-bold">Dirección</th>
                  <th className="px-4 py-3 font-bold">Sitio web</th>
                  <th className="px-4 py-3 font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.account_id} className="border-b border-border">
                    <td className="px-4 py-3 text-ink">{row.name}</td>
                    <td className="px-4 py-3 text-muted">{row.tax_id ?? '—'}</td>
                    <td className="px-4 py-3 text-muted">
                      {row.economic_sector ?? '—'}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-muted">
                      {row.address ?? '—'}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-muted">
                      {row.website ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          className="icon-btn grid h-9 w-9 place-items-center rounded"
                          aria-label={`Editar ${row.name}`}
                          onClick={() => setEditing(row)}
                        >
                          <Pencil size={16} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn grid h-9 w-9 place-items-center rounded"
                          aria-label={`Ver contactos de ${row.name}`}
                          onClick={() => setViewingPeople(row)}
                        >
                          <Users size={16} strokeWidth={2} />
                        </button>
                        {canDelete ? (
                          <button
                            type="button"
                            className="icon-btn grid h-9 w-9 place-items-center rounded text-danger"
                            aria-label={`Eliminar ${row.name}`}
                            onClick={() => void onDelete(row)}
                          >
                            <Trash2 size={16} strokeWidth={2} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={page}
              limit={LIMIT}
              total={total}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {editing ? (
        <AccountFormModal
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => void load()}
        />
      ) : null}

      {viewingPeople ? (
        <AccountPeopleModal
          account={viewingPeople}
          onClose={() => setViewingPeople(null)}
        />
      ) : null}
    </AppLayout>
  );
}

export default AccountsListPage;
