import { useState, type FormEvent } from 'react';
import {
  createAccount,
  fetchAccounts,
  updateAccount,
} from '../api/accounts-api';
import type { Account } from '../types';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

type Props = {
  editing: Account | 'new';
  onClose: () => void;
  onSaved: () => void;
};

export function AccountFormModal({ editing, onClose, onSaved }: Props) {
  const isNew = editing === 'new';

  const [name, setName] = useState(isNew ? '' : editing.name);
  const [taxId, setTaxId] = useState(isNew ? '' : (editing.tax_id ?? ''));
  const [economicSector, setEconomicSector] = useState(
    isNew ? '' : (editing.economic_sector ?? ''),
  );
  const [address, setAddress] = useState(isNew ? '' : (editing.address ?? ''));
  const [website, setWebsite] = useState(isNew ? '' : (editing.website ?? ''));
  const [searchHits, setSearchHits] = useState<Account[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        tax_id: taxId.trim() || null,
        economic_sector: economicSector.trim() || null,
        address: address.trim() || null,
        website: website.trim() || null,
      };
      if (isNew) {
        await createAccount(payload);
      } else {
        await updateAccount(editing.account_id, payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo guardar la empresa.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isNew ? 'Crear empresa' : 'Editar empresa'}
      onClick={onClose}
    >
      <form
        className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded bg-surface p-6 shadow-card"
        onSubmit={(e) => void onSubmit(e)}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-ink">
          {isNew ? 'Crear empresa' : 'Editar empresa'}
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

        <div>
          <label className={labelClass} htmlFor="account-sector">
            Sector económico
          </label>
          <input
            id="account-sector"
            className={inputClass}
            value={economicSector}
            onChange={(e) => setEconomicSector(e.target.value)}
            maxLength={120}
            placeholder="Ej. Manufactura, Servicios financieros"
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="account-address">
            Dirección
          </label>
          <input
            id="account-address"
            className={inputClass}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={255}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="account-website">
            Sitio web
          </label>
          <input
            id="account-website"
            className={inputClass}
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            maxLength={255}
            placeholder="https://"
          />
        </div>

        {isNew ? (
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

        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2 pt-1">
          <button type="submit" className={primaryButtonClass} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" className={ghostButtonClass} onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
