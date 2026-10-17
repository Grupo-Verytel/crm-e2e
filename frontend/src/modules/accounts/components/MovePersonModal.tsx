import { useState } from 'react';
import { fetchAccounts, movePersonToAccount } from '../api/accounts-api';
import type { Account, Person } from '../types';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

type Props = {
  person: Person;
  onClose: () => void;
  onMoved: () => void;
};

export function MovePersonModal({ person, onClose, onMoved }: Props) {
  const [accountSearch, setAccountSearch] = useState('');
  const [accountOptions, setAccountOptions] = useState<Account[]>([]);
  const [target, setTarget] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function searchAccounts() {
    const q = accountSearch.trim();
    if (!q) {
      setAccountOptions([]);
      return;
    }
    try {
      const data = await fetchAccounts({ q, page: 1, limit: 10 });
      setAccountOptions(
        data.items.filter((item) => item.account_id !== person.account_id),
      );
    } catch {
      setAccountOptions([]);
      setError('No se pudo buscar empresas.');
    }
  }

  async function onConfirm() {
    if (!target) {
      setError('Selecciona la empresa destino.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await movePersonToAccount(person.person_id, target.account_id);
      onMoved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo mover el contacto.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Mover ${person.name} a otra empresa`}
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded bg-surface p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-ink">Mover a otra empresa</h2>
        <p className="text-sm text-muted">
          {person.name} sale de{' '}
          <span className="font-bold text-ink">
            {person.account_name ?? 'su empresa actual'}
          </span>{' '}
          y queda en la empresa que elijas.
        </p>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="move-account-search">
            Empresa destino
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="move-account-search"
              className={`${inputClass} min-w-[220px] flex-1`}
              value={accountSearch}
              onChange={(e) => setAccountSearch(e.target.value)}
              placeholder="Buscar por nombre o NIT"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void searchAccounts();
                }
              }}
            />
            <button
              type="button"
              className={ghostButtonClass}
              onClick={() => void searchAccounts()}
            >
              Buscar
            </button>
          </div>
          {target ? (
            <p className="text-sm text-ink">
              Destino: <span className="font-bold">{target.name}</span>
              {target.tax_id ? ` · ${target.tax_id}` : ''}
            </p>
          ) : (
            <p className="text-sm text-muted">Sin empresa destino.</p>
          )}
          {accountOptions.length > 0 ? (
            <ul className="rounded border border-border bg-bg p-2 text-sm">
              {accountOptions.map((opt) => (
                <li key={opt.account_id}>
                  <button
                    type="button"
                    className="w-full px-2 py-1 text-left hover:bg-surface"
                    onClick={() => setTarget(opt)}
                  >
                    {opt.name}
                    {opt.tax_id ? ` · ${opt.tax_id}` : ''}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            className={primaryButtonClass}
            disabled={saving || !target}
            onClick={() => void onConfirm()}
          >
            {saving ? 'Moviendo…' : 'Mover contacto'}
          </button>
          <button type="button" className={ghostButtonClass} onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
