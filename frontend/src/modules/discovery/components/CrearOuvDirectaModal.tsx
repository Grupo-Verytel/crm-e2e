import { useState, type FormEvent } from 'react';
import type { Account } from '../../accounts/types';
import { useAuth } from '../../auth/hooks/useAuth';
import { ApiError } from '../../auth/types';
import { crearOuvDirecta } from '../api/ouvs-api';
import {
  saveOuvExtensions,
  type OuvDetailExtensions,
} from '../lib/ouv-detail-extensions';
import { SEGMENTO_LABEL } from '../lib/ouv-detail-meta';
import { SEGMENTOS, VERTICALES } from '../lib/ouv-vocab';
import { AccountSearchField } from './AccountSearchField';
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
  const { user } = useAuth();
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [segmento, setSegmento] = useState('');
  const [vertical, setVertical] = useState('');
  const [proyecto, setProyecto] = useState<'' | 'Recurrente' | 'No recurrente'>(
    '',
  );
  const [plazoEjecucion, setPlazoEjecucion] = useState('');
  const [probabilidadCierre, setProbabilidadCierre] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [region, setRegion] = useState('');
  const [fechaEsperadaCierre, setFechaEsperadaCierre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const comercialNombre = user?.full_name?.trim() || '—';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const tituloTrim = titulo.trim();
    if (!tituloTrim) {
      setError('Indica el título de la OUV.');
      return;
    }
    if (!selectedAccount) {
      setError('Selecciona una empresa.');
      return;
    }
    if (!segmento) {
      setError('Selecciona el segmento.');
      return;
    }
    if (!vertical) {
      setError('Selecciona la vertical.');
      return;
    }
    if (!ciudad.trim() || !region.trim()) {
      setError('Selecciona la ciudad.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const descripcionTrim = descripcion.trim();
      const ouv = await crearOuvDirecta({
        titulo: tituloTrim,
        empresa_nombre: selectedAccount.name,
        account_id: selectedAccount.account_id,
        segmento,
        vertical,
        ...(descripcionTrim ? { descripcion: descripcionTrim } : {}),
      });

      const extensions: OuvDetailExtensions = {
        origen_ouv: 'Desde OUV',
        ciudad: ciudad.trim(),
        region: region.trim(),
        ...(proyecto ? { proyecto } : {}),
        ...(plazoEjecucion.trim()
          ? { plazo_ejecucion: plazoEjecucion.trim() }
          : {}),
        ...(probabilidadCierre.trim()
          ? { probabilidad_cierre: probabilidadCierre.trim() }
          : {}),
        ...(fechaEsperadaCierre.trim()
          ? { fecha_esperada_cierre: fechaEsperadaCierre.trim() }
          : {}),
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
        <div>
          <label className={labelClass} htmlFor="create-ouv-titulo">
            Título de la OUV
          </label>
          <input
            id="create-ouv-titulo"
            className={inputClass}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
            maxLength={200}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="create-ouv-descripcion">
            Descripción
          </label>
          <input
            id="create-ouv-descripcion"
            className={inputClass}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="create-ouv-empresa">
              Empresa
            </label>
            <AccountSearchField
              id="create-ouv-empresa"
              selected={selectedAccount}
              onSelect={setSelectedAccount}
              onClear={() => setSelectedAccount(null)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="create-ouv-comercial">
              Comercial
            </label>
            <input
              id="create-ouv-comercial"
              className={`${inputClass} cursor-default opacity-90`}
              value={comercialNombre}
              readOnly
            />
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
              required
            >
              <option value="">Selecciona…</option>
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
              required
            >
              <option value="">Selecciona…</option>
              {VERTICALES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="create-ouv-origen">
              Origen
            </label>
            <input
              id="create-ouv-origen"
              className={`${inputClass} cursor-default opacity-90`}
              value="OUV Directa"
              readOnly
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="create-ouv-canal">
              Canal de origen
            </label>
            <input
              id="create-ouv-canal"
              className={`${inputClass} cursor-default opacity-90`}
              value="—"
              readOnly
            />
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
              Plazo
            </label>
            <input
              id="create-ouv-plazo"
              type="number"
              min={0}
              className={inputClass}
              value={plazoEjecucion}
              onChange={(e) => setPlazoEjecucion(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="create-ouv-prob">
              Probabilidad de cierre %
            </label>
            <input
              id="create-ouv-prob"
              type="number"
              min={0}
              max={100}
              className={inputClass}
              value={probabilidadCierre}
              onChange={(e) => setProbabilidadCierre(e.target.value)}
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
              required
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="create-ouv-fecha-esperada">
              Fecha esperada de cierre
            </label>
            <input
              id="create-ouv-fecha-esperada"
              type="date"
              className={inputClass}
              value={fechaEsperadaCierre}
              onChange={(e) => setFechaEsperadaCierre(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="create-ouv-etapa">
              Etapa
            </label>
            <input
              id="create-ouv-etapa"
              className={`${inputClass} cursor-default opacity-90`}
              value="Comercial"
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
