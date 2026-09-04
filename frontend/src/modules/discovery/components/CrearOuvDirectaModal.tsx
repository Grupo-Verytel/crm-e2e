import { useState, type FormEvent } from 'react';
import { fetchAccounts } from '../../accounts/api/accounts-api';
import type { Account } from '../../accounts/types';
import { ApiError } from '../../auth/types';
import { crearOuvDirecta } from '../api/ouvs-api';
import {
  OUV_ORIGEN_OPTIONS,
  saveOuvExtensions,
  type OuvDetailExtensions,
  type OuvOrigenLabel,
} from '../lib/ouv-detail-extensions';
import { SEGMENTO_LABEL } from '../lib/ouv-detail-meta';
import { SEGMENTOS, VERTICALES } from '../lib/ouv-vocab';
import { ColombiaCitySearchField } from './ColombiaCitySearchField';
import { ModalShell } from './ModalShell';
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
  const [organizacion, setOrganizacion] = useState('');
  const [origenOuv, setOrigenOuv] = useState<OuvOrigenLabel>('Desde OUV');
  const [segmento, setSegmento] = useState<string>(SEGMENTOS[0]);
  const [vertical, setVertical] = useState<string>(VERTICALES[0]);
  const [proyecto, setProyecto] = useState<'' | 'Recurrente' | 'No recurrente'>(
    '',
  );
  const [plazoEjecucion, setPlazoEjecucion] = useState('');
  const [probabilidadCierre, setProbabilidadCierre] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [region, setRegion] = useState('');
  const [accountQuery, setAccountQuery] = useState('');
  const [accountHits, setAccountHits] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);

  const nowLabel = new Date().toLocaleString('es-CO');

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
    const empresa = selectedAccount?.name.trim() || organizacion.trim();
    if (!empresa) {
      setError('Indica la organización.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const ouv = await crearOuvDirecta({
        titulo: empresa,
        empresa_nombre: empresa,
        segmento,
        vertical,
        descripcion: `OUV directa · ${empresa}`,
        ...(selectedAccount
          ? { account_id: selectedAccount.account_id }
          : {}),
      });

      const extensions: OuvDetailExtensions = {
        origen_ouv: origenOuv,
        ...(proyecto ? { proyecto } : {}),
        ...(plazoEjecucion.trim()
          ? { plazo_ejecucion: plazoEjecucion.trim() }
          : {}),
        ...(probabilidadCierre.trim()
          ? { probabilidad_cierre: probabilidadCierre.trim() }
          : {}),
        ...(ciudad.trim() ? { ciudad: ciudad.trim() } : {}),
        ...(region.trim() ? { region: region.trim() } : {}),
      };
      saveOuvExtensions(ouv.ouv_id, extensions);

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
    <ModalShell title="Nueva OUV" onClose={onClose} size="wide">
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-3">
            <label className={labelClass} htmlFor="create-ouv-org-q">
              Organización
            </label>
            <div className="flex gap-2">
              <input
                id="create-ouv-org-q"
                className={inputClass}
                value={accountQuery}
                onChange={(e) => setAccountQuery(e.target.value)}
                placeholder="Buscar empresa o escribir nombre"
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
                        setOrganizacion(account.name);
                        setAccountQuery(account.name);
                        setAccountHits([]);
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
            <input
              className={`${inputClass} mt-2`}
              value={organizacion}
              onChange={(e) => {
                setOrganizacion(e.target.value);
                if (selectedAccount && e.target.value !== selectedAccount.name) {
                  setSelectedAccount(null);
                }
              }}
              placeholder="Nombre de la organización"
              required
              maxLength={200}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="create-ouv-origen">
              Origen OUV
            </label>
            <select
              id="create-ouv-origen"
              className={inputClass}
              value={origenOuv}
              onChange={(e) =>
                setOrigenOuv(e.target.value as OuvOrigenLabel)
              }
            >
              {OUV_ORIGEN_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="create-ouv-segmento">
              Segmento
            </label>
            <select
              id="create-ouv-segmento"
              className={inputClass}
              value={segmento}
              onChange={(e) => setSegmento(e.target.value)}
            >
              {SEGMENTOS.map((s) => (
                <option key={s} value={s}>
                  {SEGMENTO_LABEL[s] ?? s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="create-ouv-vertical">
              Vertical
            </label>
            <select
              id="create-ouv-vertical"
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

          <div>
            <label className={labelClass} htmlFor="create-ouv-proyecto">
              Proyecto
            </label>
            <select
              id="create-ouv-proyecto"
              className={inputClass}
              value={proyecto}
              onChange={(e) =>
                setProyecto(
                  e.target.value as '' | 'Recurrente' | 'No recurrente',
                )
              }
            >
              <option value="">Sin definir</option>
              <option value="Recurrente">Recurrente</option>
              <option value="No recurrente">No recurrente</option>
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="create-ouv-plazo">
              Plazo ejecución
            </label>
            <input
              id="create-ouv-plazo"
              type="number"
              min={0}
              className={inputClass}
              value={plazoEjecucion}
              onChange={(e) => setPlazoEjecucion(e.target.value)}
              placeholder="Meses"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="create-ouv-prob">
              Probabilidad de cierre
            </label>
            <input
              id="create-ouv-prob"
              type="number"
              min={0}
              max={100}
              className={inputClass}
              value={probabilidadCierre}
              onChange={(e) => setProbabilidadCierre(e.target.value)}
              placeholder="%"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="create-ouv-ciudad">
              Ciudad
            </label>
            <ColombiaCitySearchField
              id="create-ouv-ciudad"
              value={ciudad}
              departamento={region}
              onSelect={(row) => {
                setCiudad(row.municipio);
                setRegion(row.departamento);
              }}
              onClear={() => {
                setCiudad('');
                setRegion('');
              }}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="create-ouv-region">
              Región
            </label>
            <input
              id="create-ouv-region"
              className={`${inputClass} cursor-default opacity-90`}
              value={region}
              readOnly
              placeholder="Se completa al elegir la ciudad"
            />
          </div>

          <div>
            <label className={labelClass}>Etapa</label>
            <input
              className={`${inputClass} cursor-default opacity-90`}
              value="Comercial"
              readOnly
            />
          </div>

          <div>
            <label className={labelClass}>Estado OUV</label>
            <input
              className={`${inputClass} cursor-default opacity-90`}
              value="En curso"
              readOnly
            />
          </div>

          <div>
            <label className={labelClass}>Fecha creación</label>
            <input
              className={`${inputClass} cursor-default opacity-90`}
              value={nowLabel}
              readOnly
            />
          </div>

          <div>
            <label className={labelClass}>Fecha actualización</label>
            <input
              className={`${inputClass} cursor-default opacity-90`}
              value={nowLabel}
              readOnly
            />
          </div>
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
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
    </ModalShell>
  );
}
