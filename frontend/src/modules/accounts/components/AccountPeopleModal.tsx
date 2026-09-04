import { useCallback, useEffect, useState } from 'react';
import { Users, X } from 'lucide-react';
import { fetchPeople } from '../api/accounts-api';
import type { Account, Person } from '../types';
import {
  ensureDemoPersonInfluencias,
  loadPersonInfluenciaTipo,
} from '../lib/person-influencia-extensions';
import { cardClass, ghostButtonClass } from './ui';

type Props = {
  account: Account;
  onClose: () => void;
};

export function AccountPeopleModal({ account, onClose }: Props) {
  const [items, setItems] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPeople({
        account_id: account.account_id,
        page: 1,
        limit: 100,
      });
      ensureDemoPersonInfluencias(data.items);
      setItems(data.items);
    } catch {
      setError('No se pudo cargar los contactos de esta empresa.');
    } finally {
      setLoading(false);
    }
  }, [account.account_id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Contactos de ${account.name}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded bg-surface shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Users size={18} className="text-accent" strokeWidth={2} />
              <h2 className="text-lg font-bold text-ink">Contactos vinculados</h2>
              <span className="rounded bg-bg px-1.5 py-0.5 text-xs font-bold text-muted">
                {items.length}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{account.name}</p>
          </div>
          <button
            type="button"
            className="icon-btn grid h-8 w-8 place-items-center rounded"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        <div className="overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-sm text-muted">Cargando…</p>
          ) : error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted">
              Esta empresa no tiene contactos vinculados.
            </p>
          ) : (
            <div className={`${cardClass} overflow-x-auto`}>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted">
                    <th className="px-4 py-3 font-bold">Nombre</th>
                    <th className="px-4 py-3 font-bold">Cargo</th>
                    <th className="px-4 py-3 font-bold">Influencia</th>
                    <th className="px-4 py-3 font-bold">Email</th>
                    <th className="px-4 py-3 font-bold">Teléfono</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.person_id} className="border-b border-border">
                      <td className="px-4 py-3 text-ink">{row.name}</td>
                      <td className="px-4 py-3 text-muted">
                        {row.job_title ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {loadPersonInfluenciaTipo(row.person_id) ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {row.email ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {row.phone ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className="border-t border-border px-6 py-4">
          <button type="button" className={ghostButtonClass} onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}
