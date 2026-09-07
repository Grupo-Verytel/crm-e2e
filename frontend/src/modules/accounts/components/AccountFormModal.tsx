import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  createAccount,
  fetchAccounts,
  updateAccount,
} from '../api/accounts-api';
import { ECONOMIC_SECTORS } from '../lib/economic-sectors';
import type { Account } from '../types';
import { FloatingToast } from './FloatingToast';
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

type SearchField = 'name' | 'tax';

function normalizeNit(value: string): string {
  return value.replace(/[\s.\-]/g, '').toLowerCase();
}

function isSameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function isSameNit(a: string, b: string | null | undefined): boolean {
  if (!a.trim() || !b?.trim()) {
    return false;
  }
  return normalizeNit(a) === normalizeNit(b);
}

function duplicateMessage(account: Account): string {
  const nitPart = account.tax_id ? ` · NIT ${account.tax_id}` : '';
  return `Ya existe «${account.name}${nitPart}». Edítala desde el listado; no se puede crear de nuevo.`;
}

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
  const [activeField, setActiveField] = useState<SearchField | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const nameWrapRef = useRef<HTMLDivElement>(null);
  const taxWrapRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const lastDuplicateIdRef = useRef<string | null>(null);

  function showToast(message: string) {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 4500);
  }

  /** Live search by name and/or NIT while creating. */
  useEffect(() => {
    if (!isNew) {
      return;
    }
    const nameQ = name.trim();
    const taxQ = taxId.trim();
    if (nameQ.length < 2 && taxQ.length < 2) {
      setSearchHits([]);
      setSearching(false);
      setListOpen(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      const queries = [
        nameQ.length >= 2 ? nameQ : null,
        taxQ.length >= 2 ? taxQ : null,
      ].filter((q): q is string => q != null);

      void Promise.all(
        queries.map((q) => fetchAccounts({ q, page: 1, limit: 10 })),
      )
        .then((results) => {
          if (!active) {
            return;
          }
          const byId = new Map<string, Account>();
          for (const page of results) {
            for (const item of page.items) {
              byId.set(item.account_id, item);
            }
          }
          setSearchHits([...byId.values()]);
          if (activeField) {
            setListOpen(true);
          }
        })
        .catch(() => {
          if (active) {
            setSearchHits([]);
          }
        })
        .finally(() => {
          if (active) {
            setSearching(false);
          }
        });
    }, 280);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [isNew, name, taxId, activeField]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !nameWrapRef.current?.contains(target) &&
        !taxWrapRef.current?.contains(target)
      ) {
        setListOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const requiredFilled =
    name.trim().length > 0 &&
    taxId.trim().length > 0 &&
    economicSector.trim().length > 0 &&
    address.trim().length > 0;

  const duplicateAccount = useMemo(() => {
    if (!isNew) {
      return null;
    }
    return (
      searchHits.find(
        (hit) => isSameName(hit.name, name) || isSameNit(taxId, hit.tax_id),
      ) ?? null
    );
  }, [isNew, name, taxId, searchHits]);

  useEffect(() => {
    if (!duplicateAccount) {
      lastDuplicateIdRef.current = null;
      return;
    }
    if (lastDuplicateIdRef.current === duplicateAccount.account_id) {
      return;
    }
    lastDuplicateIdRef.current = duplicateAccount.account_id;
    showToast(duplicateMessage(duplicateAccount));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast helper is stable for this mount
  }, [duplicateAccount]);

  const canSubmit =
    requiredFilled && !saving && !searching && !(isNew && duplicateAccount);

  function pickExisting(account: Account) {
    setName(account.name);
    setTaxId(account.tax_id ?? '');
    setEconomicSector(account.economic_sector ?? '');
    setAddress(account.address ?? '');
    setWebsite(account.website ?? '');
    setSearchHits([account]);
    setListOpen(false);
    setActiveField(null);
    lastDuplicateIdRef.current = account.account_id;
    showToast(duplicateMessage(account));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      return;
    }
    if (isNew && duplicateAccount) {
      showToast(duplicateMessage(duplicateAccount));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        tax_id: taxId.trim(),
        economic_sector: economicSector.trim(),
        address: address.trim(),
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
      showToast(
        err instanceof Error ? err.message : 'No se pudo guardar la empresa.',
      );
    } finally {
      setSaving(false);
    }
  }

  function renderHits() {
    if (!isNew || !listOpen || !activeField) {
      return null;
    }
    if (searching) {
      return (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded border border-border bg-surface shadow-card">
          <li className="px-3 py-2 text-sm text-muted">Buscando…</li>
        </ul>
      );
    }
    if (searchHits.length === 0) {
      return null;
    }
    return (
      <ul
        className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded border border-border bg-surface shadow-card"
        role="listbox"
      >
        {searchHits.map((hit) => (
          <li key={hit.account_id} role="option">
            <button
              type="button"
              onClick={() => pickExisting(hit)}
              className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-bg"
            >
              <span className="font-bold text-ink">{hit.name}</span>
              {hit.tax_id ? (
                <span className="text-xs text-muted">NIT: {hit.tax_id}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    );
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

        <div className="relative" ref={nameWrapRef}>
          <label className={labelClass} htmlFor="account-name">
            Nombre
          </label>
          <input
            id="account-name"
            className={inputClass}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setActiveField('name');
            }}
            onFocus={() => {
              setActiveField('name');
              if (searchHits.length > 0 && name.trim().length >= 2) {
                setListOpen(true);
              }
            }}
            required
            maxLength={160}
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={activeField === 'name' && listOpen}
          />
          {activeField === 'name' ? renderHits() : null}
        </div>

        <div className="relative" ref={taxWrapRef}>
          <label className={labelClass} htmlFor="account-tax">
            NIT
          </label>
          <input
            id="account-tax"
            className={inputClass}
            value={taxId}
            onChange={(e) => {
              setTaxId(e.target.value);
              setActiveField('tax');
            }}
            onFocus={() => {
              setActiveField('tax');
              if (searchHits.length > 0 && taxId.trim().length >= 2) {
                setListOpen(true);
              }
            }}
            required
            maxLength={20}
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={activeField === 'tax' && listOpen}
          />
          {activeField === 'tax' ? renderHits() : null}
        </div>

        <div>
          <label className={labelClass} htmlFor="account-sector">
            Sector económico
          </label>
          <select
            id="account-sector"
            className={inputClass}
            value={economicSector}
            onChange={(e) => setEconomicSector(e.target.value)}
            required
          >
            <option value="">Seleccionar sector</option>
            {ECONOMIC_SECTORS.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
            {economicSector &&
            !ECONOMIC_SECTORS.includes(
              economicSector as (typeof ECONOMIC_SECTORS)[number],
            ) ? (
              <option value={economicSector}>{economicSector}</option>
            ) : null}
          </select>
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
            required
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="account-website">
            Sitio web (opcional)
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

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            className={primaryButtonClass}
            disabled={!canSubmit}
            title={
              !requiredFilled
                ? 'Completa Nombre, NIT, Sector y Dirección'
                : duplicateAccount
                  ? 'La empresa ya existe'
                  : undefined
            }
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" className={ghostButtonClass} onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>

      {toast ? (
        <div onClick={(e) => e.stopPropagation()}>
          <FloatingToast
            message={toast}
            tone="error"
            onDismiss={() => setToast(null)}
          />
        </div>
      ) : null}
    </div>
  );
}
