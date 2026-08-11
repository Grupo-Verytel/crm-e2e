import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../../../layout/AppLayout';
import { Pagination } from '../../../components/Pagination';
import { useAuth } from '../../auth/hooks/useAuth';
import { ApiError } from '../../auth/types';
import {
  createPerson,
  deletePerson,
  fetchAccounts,
  fetchPeople,
  updatePerson,
} from '../api/accounts-api';
import type { Account, Person } from '../types';
import {
  cardClass,
  dangerButtonClass,
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '../components/ui';

const LIMIT = 20;

export function PeopleListPage() {
  const { user } = useAuth();
  const canDelete = Boolean(
    user?.permissions?.some(
      (p) => p.action === 'delete' && p.subject === 'Person',
    ),
  );

  const [draftQ, setDraftQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Person | null | 'new'>(null);
  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [accountId, setAccountId] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [accountOptions, setAccountOptions] = useState<Account[]>([]);
  const [lockedAccountName, setLockedAccountName] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

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

  function openNew() {
    setEditing('new');
    setName('');
    setJobTitle('');
    setEmail('');
    setPhone('');
    setAccountId('');
    setAccountSearch('');
    setAccountOptions([]);
    setLockedAccountName(null);
  }

  function openEdit(row: Person) {
    setEditing(row);
    setName(row.name);
    setJobTitle(row.job_title ?? '');
    setEmail(row.email ?? '');
    setPhone(row.phone ?? '');
    setAccountId(row.account_id);
    setLockedAccountName(row.account_name ?? row.account_id);
    setAccountSearch('');
    setAccountOptions([]);
  }

  async function searchAccounts() {
    const q = accountSearch.trim();
    if (!q) {
      setAccountOptions([]);
      return;
    }
    try {
      const data = await fetchAccounts({ q, page: 1, limit: 10 });
      setAccountOptions(data.items);
    } catch {
      setAccountOptions([]);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (editing === 'new' && !accountId) {
      setError('Debes seleccionar una empresa para el contacto.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing === 'new') {
        await createPerson({
          name: name.trim(),
          job_title: jobTitle.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          account_id: accountId,
        });
      } else if (editing) {
        await updatePerson(editing.person_id, {
          name: name.trim(),
          job_title: jobTitle.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
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

  async function onDelete(row: Person) {
    if (!window.confirm(`¿Eliminar el contacto "${row.name}"?`)) return;
    setError(null);
    try {
      await deletePerson(row.person_id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar.');
    }
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
          <button type="button" className={primaryButtonClass} onClick={openNew}>
            Nuevo contacto
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
            {editing === 'new' ? 'Crear contacto' : 'Editar contacto'}
          </h2>
          <div>
            <label className={labelClass} htmlFor="person-name">
              Nombre
            </label>
            <input
              id="person-name"
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="person-job">
              Cargo
            </label>
            <input
              id="person-job"
              className={inputClass}
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              maxLength={80}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="person-email">
              Email
            </label>
            <input
              id="person-email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={180}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="person-phone">
              Teléfono
            </label>
            <input
              id="person-phone"
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
            />
          </div>

          {editing === 'new' ? (
            <div className="space-y-2">
              <label className={labelClass} htmlFor="person-account-search">
                Empresa (obligatoria)
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  id="person-account-search"
                  className={`${inputClass} min-w-[220px] flex-1`}
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  placeholder="Buscar empresa por nombre o NIT"
                />
                <button
                  type="button"
                  className={ghostButtonClass}
                  onClick={() => void searchAccounts()}
                >
                  Buscar
                </button>
              </div>
              {accountId ? (
                <p className="text-sm text-ink">
                  Seleccionada:{' '}
                  <span className="font-bold">
                    {accountOptions.find((a) => a.account_id === accountId)
                      ?.name ?? accountId}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-muted">Sin empresa seleccionada.</p>
              )}
              {accountOptions.length > 0 ? (
                <ul className="rounded border border-border bg-bg p-2 text-sm">
                  {accountOptions.map((opt) => (
                    <li key={opt.account_id}>
                      <button
                        type="button"
                        className="w-full px-2 py-1 text-left hover:bg-surface"
                        onClick={() => setAccountId(opt.account_id)}
                      >
                        {opt.name}
                        {opt.tax_id ? ` · ${opt.tax_id}` : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <div>
              <p className={labelClass}>Empresa</p>
              <p className="text-sm text-ink">
                {lockedAccountName ?? '—'}{' '}
                <span className="text-muted">(no editable)</span>
              </p>
            </div>
          )}

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
          <p className="p-4 text-sm text-muted">No hay contactos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="px-4 py-3 font-bold">Nombre</th>
                  <th className="px-4 py-3 font-bold">Empresa</th>
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
                    <td className="px-4 py-3 text-muted">{row.email ?? '—'}</td>
                    <td className="px-4 py-3 text-muted">{row.phone ?? '—'}</td>
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
