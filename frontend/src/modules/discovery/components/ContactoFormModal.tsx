import { useEffect, useState, type FormEvent } from 'react';
import {
  createAccount,
  createPerson,
  fetchAccounts,
} from '../../accounts/api/accounts-api';
import type { Account } from '../../accounts/types';
import { ApiError } from '../../auth/types';
import type { ContactoPayload, OuvContacto } from '../api/ouvs-api';
import {
  savePersonInfluenciaTipo,
  type PersonInfluenciaTipo,
} from '../../accounts/lib/person-influencia-extensions';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

type Props = {
  initial?: OuvContacto | null;
  /** When set (e.g. OUV already has account), lock new contacts to that account. */
  lockAccountId?: string | null;
  /** Influence type when adding from an influencia card. */
  influenciaTipo?: string | null;
  onClose: () => void;
  onSave: (
    payload: ContactoPayload,
    meta?: { influenciaTipo?: PersonInfluenciaTipo | null },
  ) => Promise<void>;
};

export function ContactoFormModal({
  initial,
  lockAccountId,
  influenciaTipo,
  onClose,
  onSave,
}: Props) {
  const isEdit = Boolean(initial);

  const [notas, setNotas] = useState(initial?.notas ?? '');
  const [accountQuery, setAccountQuery] = useState('');
  const [accountHits, setAccountHits] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonEmail, setNewPersonEmail] = useState('');
  const [newPersonJob, setNewPersonJob] = useState('');
  const [newPersonPhone, setNewPersonPhone] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountTaxId, setNewAccountTaxId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const assignedInfluenciaTipo =
    (influenciaTipo as PersonInfluenciaTipo | undefined) || null;

  useEffect(() => {
    setNotas(initial?.notas ?? '');
  }, [initial]);

  async function searchAccounts() {
    const q = accountQuery.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      const data = await fetchAccounts({ q, limit: 10 });
      setAccountHits(data.items);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'No se pudo buscar empresas.',
      );
    } finally {
      setSearching(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await onSave(
          { notas: notas.trim() || null },
          { influenciaTipo: assignedInfluenciaTipo },
        );
        onClose();
        return;
      }

      let accountId = lockAccountId || selectedAccount?.account_id || null;
      if (!accountId) {
        if (!newAccountName.trim()) {
          throw new Error('Selecciona o crea una empresa.');
        }
        const account = await createAccount({
          name: newAccountName.trim(),
          tax_id: newAccountTaxId.trim() || null,
        });
        accountId = account.account_id;
      }
      if (!newPersonName.trim()) {
        throw new Error('Indica el nombre del contacto nuevo.');
      }
      const person = await createPerson({
        name: newPersonName.trim(),
        email: newPersonEmail.trim() || null,
        job_title: newPersonJob.trim() || null,
        phone: newPersonPhone.trim() || null,
        account_id: accountId,
      });
      const personId = person.person_id;

      await onSave(
        {
          person_id: personId,
          notas: notas.trim() || undefined,
        },
        { influenciaTipo: assignedInfluenciaTipo },
      );
      if (personId && assignedInfluenciaTipo) {
        savePersonInfluenciaTipo(personId, assignedInfluenciaTipo);
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudo guardar el contacto.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded bg-surface p-6 shadow-card">
        <h2 className="mb-4 text-lg font-bold text-ink">
          {isEdit ? 'Editar notas del contacto' : 'Agregar contacto'}
        </h2>
        <form className="space-y-3" onSubmit={onSubmit}>
          {isEdit ? (
            <div className="rounded bg-bg p-3 text-sm text-ink">
              <p className="font-bold">{initial?.name}</p>
              <p className="text-xs text-muted">
                {[initial?.job_title, initial?.email, initial?.account_name]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p className="mt-1 text-xs text-muted">
                Nombre, email y cargo se editan en Empresas / Contactos.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
                  {!lockAccountId ? (
                    <>
                      <div>
                        <label className={labelClass} htmlFor="c-acc-q">
                          Empresa
                        </label>
                        <div className="flex gap-2">
                          <input
                            id="c-acc-q"
                            className={inputClass}
                            value={accountQuery}
                            onChange={(e) => setAccountQuery(e.target.value)}
                            placeholder="Buscar empresa"
                          />
                          <button
                            type="button"
                            className={ghostButtonClass}
                            onClick={() => void searchAccounts()}
                            disabled={searching}
                          >
                            Buscar
                          </button>
                        </div>
                        {accountHits.length > 0 ? (
                          <ul className="mt-2 max-h-28 overflow-y-auto rounded border border-border">
                            {accountHits.map((account) => (
                              <li key={account.account_id}>
                                <button
                                  type="button"
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-bg"
                                  onClick={() => {
                                    setSelectedAccount(account);
                                    setNewAccountName('');
                                  }}
                                >
                                  <span className="font-bold text-ink">
                                    {account.name}
                                  </span>
                                  {account.tax_id ? (
                                    <span className="block text-xs text-muted">
                                      NIT: {account.tax_id}
                                    </span>
                                  ) : null}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {selectedAccount ? (
                          <p className="mt-1 text-xs text-muted">
                            Empresa:{' '}
                            <span className="font-bold text-ink">
                              {selectedAccount.name}
                            </span>
                          </p>
                        ) : (
                          <div className="mt-2 grid gap-2">
                            <input
                              className={inputClass}
                              placeholder="Nueva empresa — nombre"
                              value={newAccountName}
                              onChange={(e) =>
                                setNewAccountName(e.target.value)
                              }
                            />
                            <input
                              className={inputClass}
                              placeholder="NIT (opcional)"
                              value={newAccountTaxId}
                              onChange={(e) =>
                                setNewAccountTaxId(e.target.value)
                              }
                            />
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted">
                      Los contactos deben pertenecer a la empresa ya asociada a
                      esta OUV.
                    </p>
                  )}
                  <input
                    className={inputClass}
                    placeholder="Nombre del contacto"
                    value={newPersonName}
                    onChange={(e) => setNewPersonName(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    placeholder="Cargo"
                    value={newPersonJob}
                    onChange={(e) => setNewPersonJob(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    type="email"
                    placeholder="Email"
                    value={newPersonEmail}
                    onChange={(e) => setNewPersonEmail(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    placeholder="Teléfono"
                    value={newPersonPhone}
                    onChange={(e) => setNewPersonPhone(e.target.value)}
                  />
            </div>
          )}

          <div>
            <label className={labelClass} htmlFor="c-notas">
              Notas (solo esta OUV)
            </label>
            <textarea
              id="c-notas"
              className={`${inputClass} h-20 py-2`}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={ghostButtonClass} onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className={primaryButtonClass}
              disabled={saving}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
