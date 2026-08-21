import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../../../layout/AppLayout';
import { Pagination } from '../../../components/Pagination';
import { useAuth } from '../../auth/hooks/useAuth';
import { ApiError } from '../../auth/types';
import {
  createAccount,
  deleteAccount,
  fetchAccounts,
  updateAccount,
} from '../api/accounts-api';
import type { Account } from '../types';
import {
  cardClass,
  dangerButtonClass,
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '../components/ui';

const LIMIT = 20;

export function AccountsListPage() {
  const { user } = useAuth();
  const canDelete = Boolean(
    user?.permissions?.some(
      (p) => p.action === 'delete' && p.subject === 'Account',
    ),
  );

  const [draftQ, setDraftQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Account | null | 'new'>(null);
  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [searchHits, setSearchHits] = useState<Account[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAccounts({
        q: appliedQ || undefined,
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
  }, [appliedQ, page]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilters() {
    setAppliedQ(draftQ.trim());
    setPage(1);
  }

  function openNew() {
    setEditing('new');
    setName('');
    setTaxId('');
    setSearchHits([]);
  }

  function openEdit(row: Account) {
    setEditing(row);
    setName(row.name);
    setTaxId(row.tax_id ?? '');
    setSearchHits([]);
  }

  async function runPreSearch() {
    const q = [name.trim(), taxId.trim()].filter(Boolean).join(' ').trim();
    if (!q) {
      setSearchHits([]);
      return;
    }
    setSearching(true);
    try {
      const data = await fetchAccounts({ q, page: 1, limit: 10 });
      setSearchHits(data.items);
    } catch {
      setSearchHits([]);
    } finally {
      setSearching(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editing === 'new') {
        await createAccount({
          name: name.trim(),
          tax_id: taxId.trim() || null,
        });
      } else if (editing) {
        await updateAccount(editing.account_id, {
          name: name.trim(),
          tax_id: taxId.trim() || null,
        });
      }
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

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
      <div className={`${cardClass} mb-4 p-4`}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className={labelClass} htmlFor="accounts-q">
              Buscar
            </label>
            <input
              id="accounts-q"
              className={inputClass}
              value={draftQ}
              onChange={(e) => setDraftQ(e.target.value)}
              placeholder="Nombre o NIT"
            />
          </div>
          <button type="button" className={primaryButtonClass} onClick={applyFilters}>
            Aplicar
          </button>
          <button type="button" className={primaryButtonClass} onClick={openNew}>
            Nueva empresa
          </button>
        </div>
      </div>

      {error ? (
        <p className="mb-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {editing ? (
        <form
          onSubmit={onSubmit}
          className={`${cardClass} mb-4 space-y-3 p-4`}
        >
          <h2 className="text-sm font-bold text-ink">
            {editing === 'new' ? 'Crear empresa' : 'Editar empresa'}
          </h2>
          <div>
            <label className={labelClass} htmlFor="account-name">
              Nombre
            </label>
            <input
              id="account-name"
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={160}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="account-tax">
              NIT / tax_id (opcional)
            </label>
            <input
              id="account-tax"
              className={inputClass}
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              maxLength={20}
            />
          </div>
          {editing === 'new' ? (
            <div className="space-y-2">
              <button
                type="button"
                className={ghostButtonClass}
                onClick={() => void runPreSearch()}
                disabled={searching}
              >
                {searching ? 'Buscando…' : 'Buscar si ya existe'}
              </button>
              {searchHits.length > 0 ? (
                <div className="rounded border border-border bg-bg p-3 text-sm">
                  <p className="mb-2 font-bold text-ink">
                    Posibles coincidencias — revisa antes de crear:
                  </p>
                  <ul className="space-y-1 text-muted">
                    {searchHits.map((hit) => (
                      <li key={hit.account_id}>
                        {hit.name}
                        {hit.tax_id ? ` · ${hit.tax_id}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex gap-2">
            <button type="submit" className={primaryButtonClass} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              className={ghostButtonClass}
              onClick={() => setEditing(null)}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <div className={cardClass}>
        {loading ? (
          <p className="p-4 text-sm text-muted">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-muted">No hay empresas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="px-4 py-3 font-bold">Nombre</th>
                  <th className="px-4 py-3 font-bold">NIT</th>
                  <th className="px-4 py-3 font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.account_id} className="border-b border-border">
                    <td className="px-4 py-3 text-ink">{row.name}</td>
                    <td className="px-4 py-3 text-muted">{row.tax_id ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={ghostButtonClass}
                          onClick={() => openEdit(row)}
                        >
                          Editar
                        </button>
                        {canDelete ? (
                          <button
                            type="button"
                            className={dangerButtonClass}
                            onClick={() => void onDelete(row)}
                          >
                            Eliminar
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
    </AppLayout>
  );
}
