import { useState, type FormEvent } from 'react';
import { fetchAccounts } from '../../accounts/api/accounts-api';
import type { Account } from '../../accounts/types';
import { ApiError } from '../../auth/types';
import { crearOuvDirecta } from '../api/ouvs-api';
import { SEGMENTOS, VERTICALES } from '../lib/ouv-vocab';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

type Props = {
  onClose: () => void;
  onCreated: (ouvId: string, consecutivo: string) => void;
};

export function CrearOuvDirectaModal({ onClose, onCreated }: Props) {
  const [titulo, setTitulo] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [segmento, setSegmento] = useState<string>(SEGMENTOS[3]);
  const [vertical, setVertical] = useState<string>(VERTICALES[0]);
  const [descripcion, setDescripcion] = useState('');
  const [accountQuery, setAccountQuery] = useState('');
  const [accountHits, setAccountHits] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);

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
      const ouv = await crearOuvDirecta({
        titulo: titulo.trim(),
        empresa_nombre: selectedAccount?.name.trim() || empresa.trim(),
        segmento,
        vertical,
        descripcion: descripcion.trim(),
        ...(selectedAccount
          ? { account_id: selectedAccount.account_id }
          : {}),
      });
      onCreated(ouv.ouv_id, ouv.consecutivo);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo crear la OUV directa.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded bg-surface p-6 shadow-card">
        <h2 className="mb-4 text-lg font-bold text-ink">Crear OUV directa</h2>
        <form className="space-y-3" onSubmit={onSubmit}>
          <div>
            <label className={labelClass} htmlFor="ouv-titulo">
              Título
            </label>
            <input
              id="ouv-titulo"
              className={inputClass}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              maxLength={200}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ouv-acc-q">
              Empresa (opcional — catálogo accounts)
            </label>
            <div className="flex gap-2">
              <input
                id="ouv-acc-q"
                className={inputClass}
                value={accountQuery}
                onChange={(e) => setAccountQuery(e.target.value)}
                placeholder="Buscar por nombre o NIT"
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
                        setEmpresa(account.name);
                      }}
                    >
                      <span className="font-bold text-ink">{account.name}</span>
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
                Seleccionada:{' '}
                <span className="font-bold text-ink">{selectedAccount.name}</span>{' '}
                <button
                  type="button"
                  className="text-accent underline"
                  onClick={() => setSelectedAccount(null)}
                >
                  quitar
                </button>
              </p>
            ) : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="ouv-empresa">
              Nombre empresa (snapshot)
            </label>
            <input
              id="ouv-empresa"
              className={inputClass}
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              required
              maxLength={200}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="ouv-segmento">
                Segmento
              </label>
              <select
                id="ouv-segmento"
                className={inputClass}
                value={segmento}
                onChange={(e) => setSegmento(e.target.value)}
              >
                {SEGMENTOS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="ouv-vertical">
                Vertical
              </label>
              <select
                id="ouv-vertical"
                className={inputClass}
                value={vertical}
                onChange={(e) => setVertical(e.target.value)}
              >
                {VERTICALES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="ouv-desc">
              Descripción
            </label>
            <textarea
              id="ouv-desc"
              className={`${inputClass} h-24 py-2`}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              required
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
              {saving ? 'Creando…' : 'Crear OUV'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
