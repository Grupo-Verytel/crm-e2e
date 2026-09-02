import { useEffect, useState, type FormEvent } from 'react';
import {
  createPerson,
  fetchAccounts,
  updatePerson,
} from '../api/accounts-api';
import type { Account, Person } from '../types';
import {
  loadPersonInfluenciaTipo,
  PERSON_INFLUENCIA_TIPOS,
  savePersonInfluenciaTipo,
  type PersonInfluenciaTipo,
} from '../lib/person-influencia-extensions';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

type Props = {
  editing: Person | 'new';
  onClose: () => void;
  onSaved: () => void;
};

export function PersonFormModal({ editing, onClose, onSaved }: Props) {
  const isNew = editing === 'new';

  const [name, setName] = useState(isNew ? '' : editing.name);
  const [jobTitle, setJobTitle] = useState(isNew ? '' : (editing.job_title ?? ''));
  const [email, setEmail] = useState(isNew ? '' : (editing.email ?? ''));
  const [phone, setPhone] = useState(isNew ? '' : (editing.phone ?? ''));
  const [influenciaTipo, setInfluenciaTipo] = useState<
    PersonInfluenciaTipo | ''
  >('');
  const [accountId, setAccountId] = useState(isNew ? '' : editing.account_id);
  const [accountSearch, setAccountSearch] = useState('');
  const [accountOptions, setAccountOptions] = useState<Account[]>([]);
  const [lockedAccountName, setLockedAccountName] = useState<string | null>(
    isNew ? null : (editing.account_name ?? editing.account_id),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNew && editing !== 'new') {
      setInfluenciaTipo(loadPersonInfluenciaTipo(editing.person_id) ?? '');
    }
  }, [editing, isNew]);

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
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        if (!accountId) {
          throw new Error('Selecciona una empresa para el contacto.');
        }
        const created = await createPerson({
          name: name.trim(),
          job_title: jobTitle.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          account_id: accountId,
        });
        if (influenciaTipo) {
          savePersonInfluenciaTipo(created.person_id, influenciaTipo);
        }
      } else {
        await updatePerson(editing.person_id, {
          name: name.trim(),
          job_title: jobTitle.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
        });
        savePersonInfluenciaTipo(
          editing.person_id,
          influenciaTipo || null,
        );
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo guardar el contacto.',
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
      aria-label={isNew ? 'Crear contacto' : 'Editar contacto'}
      onClick={onClose}
    >
      <form
        className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded bg-surface p-6 shadow-card"
        onSubmit={(e) => void onSubmit(e)}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-ink">
          {isNew ? 'Crear contacto' : 'Editar contacto'}
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

        <div>
          <label className={labelClass} htmlFor="person-influencia">
            Tipo de influencia
          </label>
          <select
            id="person-influencia"
            className={inputClass}
            value={influenciaTipo}
            onChange={(e) =>
              setInfluenciaTipo(e.target.value as PersonInfluenciaTipo | '')
            }
          >
            <option value="">Sin definir</option>
            {PERSON_INFLUENCIA_TIPOS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </div>

        {isNew ? (
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
