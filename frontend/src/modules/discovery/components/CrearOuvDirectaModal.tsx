import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { fetchAccounts } from '../../accounts/api/accounts-api';
import type { Account } from '../../accounts/types';
import { ApiError } from '../../auth/types';
import { fetchSegments } from '../../demand-generation/api/segments-api';
import type { Segment } from '../../demand-generation/types';
import { crearOuvDirecta } from '../api/ouvs-api';
import { saveOuvExtensions } from '../lib/ouv-detail-extensions';
import { SEGMENTOS, VERTICALES } from '../lib/ouv-vocab';
import { ColombiaCitySearchField } from './ColombiaCitySearchField';
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

const SEGMENTO_ENUM = new Set<string>(SEGMENTOS);

/** Map segments.name → OuvSegmento ENUM. */
function segmentNameToEnum(name: string): string {
  if (name === 'Gobierno' || name === 'Gobierno central') return 'Gobierno central';
  if (name === 'D&S' || name === 'Defensa y seguridad') return 'Defensa y seguridad';
  if (
    name === 'Proyectos Especiales' ||
    name === 'ProyectosEspeciales' ||
    name === 'Ciudades y gobernaciones'
  ) {
    return 'Ciudades y gobernaciones';
  }
  if (name === 'B2B' || name === 'Industria') return 'Industria';
  return name;
}

export function CrearOuvDirectaModal({ onClose, onCreated }: Props) {
  const [organizacion, setOrganizacion] = useState('');
  const [nombre, setNombre] = useState('');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentId, setSegmentId] = useState('');
  const [subsegmentId, setSubsegmentId] = useState('');
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
  const [loadingSegments, setLoadingSegments] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchSegments();
        if (cancelled) return;
        setSegments(data);
        if (data[0]?.id) setSegmentId(data[0].id);
      } catch {
        if (!cancelled) setError('No se pudieron cargar los segmentos.');
      } finally {
        if (!cancelled) setLoadingSegments(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedSegment = useMemo(
    () => segments.find((segment) => segment.id === segmentId) ?? null,
    [segments, segmentId],
  );
  const subsegments = selectedSegment?.subsegments ?? [];

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
    const titulo = nombre.trim();
    if (!empresa) {
      setError('Indica la organización.');
      return;
    }
    if (!titulo) {
      setError('Indica el nombre de la OUV.');
      return;
    }
    const segment = segments.find((item) => item.id === segmentId);
    if (!segment) {
      setError('El segmento es obligatorio.');
      return;
    }
    const segmento = segmentNameToEnum(segment.name);
    if (!SEGMENTO_ENUM.has(segmento)) {
      setError('Segmento inválido.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const ouv = await crearOuvDirecta({
        titulo,
        empresa_nombre: empresa,
        segmento,
        vertical,
        descripcion: `OUV directa · ${titulo}`,
        segment_id: segment.id,
        ...(subsegmentId ? { subsegment_id: subsegmentId } : {}),
        ...(selectedAccount
          ? { account_id: selectedAccount.account_id }
          : {}),
        ...(ciudad.trim() ? { city: ciudad.trim() } : {}),
        ...(region.trim() ? { region: region.trim() } : {}),
      });

      saveOuvExtensions(ouv.ouv_id, {
        ...(proyecto ? { proyecto } : {}),
        ...(plazoEjecucion.trim()
          ? { plazo_ejecucion: plazoEjecucion.trim() }
          : {}),
        ...(probabilidadCierre.trim()
          ? { probabilidad_cierre: probabilidadCierre.trim() }
          : {}),
        ...(ciudad.trim() ? { ciudad: ciudad.trim() } : {}),
        ...(region.trim() ? { region: region.trim() } : {}),
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Nueva OUV"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded bg-surface p-6 shadow-card transition-[max-width] duration-200"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-ink">Nueva OUV</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
            aria-label="Cerrar"
          >
            Cerrar
          </button>
        </div>
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
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
                  onChange={(event) => setAccountQuery(event.target.value)}
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
                onChange={(event) => {
                  setOrganizacion(event.target.value);
                  if (
                    selectedAccount &&
                    event.target.value !== selectedAccount.name
                  ) {
                    setSelectedAccount(null);
                  }
                }}
                placeholder="Nombre de la organización"
                required
                maxLength={200}
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className={labelClass} htmlFor="create-ouv-nombre">
                Nombre de la OUV
              </label>
              <input
                id="create-ouv-nombre"
                className={inputClass}
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                placeholder="Nombre de la oportunidad"
                required
                maxLength={200}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="create-ouv-segmento">
                Segmento
              </label>
              <select
                id="create-ouv-segmento"
                className={inputClass}
                value={segmentId}
                onChange={(event) => {
                  setSegmentId(event.target.value);
                  setSubsegmentId('');
                }}
                required
                disabled={loadingSegments}
              >
                <option value="" disabled>
                  {loadingSegments ? 'Cargando…' : 'Seleccionar'}
                </option>
                {segments.map((segment) => (
                  <option key={segment.id} value={segment.id}>
                    {segment.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass} htmlFor="create-ouv-subsegmento">
                Subsegmento
              </label>
              <select
                id="create-ouv-subsegmento"
                className={inputClass}
                value={subsegmentId}
                onChange={(event) => setSubsegmentId(event.target.value)}
                disabled={loadingSegments || subsegments.length === 0}
              >
                <option value="">Sin subsegmento</option>
                {subsegments.map((subsegment) => (
                  <option key={subsegment.id} value={subsegment.id}>
                    {subsegment.name}
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
                onChange={(event) => setVertical(event.target.value)}
              >
                {VERTICALES.map((item) => (
                  <option key={item} value={item}>
                    {item}
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
                onChange={(event) =>
                  setProyecto(
                    event.target.value as '' | 'Recurrente' | 'No recurrente',
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
                onChange={(event) => setPlazoEjecucion(event.target.value)}
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
                onChange={(event) => setProbabilidadCierre(event.target.value)}
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
      </div>
    </div>
  );
}
