import { useMemo, useState, type FormEvent } from 'react';
import { ApiError } from '../../auth/types';
import type { Ouv, UpdateOuvPayload } from '../api/ouvs-api';
import {
  OUV_RESULTADO_LABEL,
  OUV_ZONA_LABEL,
  SEGMENTOS,
  VERTICALES,
} from '../lib/ouv-vocab';
import { ModalShell } from './ModalShell';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  readonlyInputClass,
} from './ui';

type Props = {
  ouv: Ouv;
  onClose: () => void;
  onSaved: (updated: Ouv) => void;
  save: (payload: UpdateOuvPayload) => Promise<Ouv>;
};

/**
 * Edit the same header fields the user sees when creating or consulting an
 * OUV: title, organization, segmento, vertical and description.
 * Zona, resultado and presupuesto keep their own menu actions.
 */
export function EditOuvModal({ ouv, onClose, onSaved, save }: Props) {
  const [titulo, setTitulo] = useState(ouv.titulo ?? '');
  const [empresa, setEmpresa] = useState(ouv.empresa_nombre ?? '');
  const [segmento, setSegmento] = useState(ouv.segmento ?? '');
  const [vertical, setVertical] = useState(ouv.vertical ?? '');
  const [descripcion, setDescripcion] = useState(ouv.descripcion ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const payload = useMemo<UpdateOuvPayload>(() => {
    const diff: UpdateOuvPayload = {};
    const t = titulo.trim();
    const e = empresa.trim();
    const d = descripcion.trim();
    if (t !== (ouv.titulo ?? '').trim()) diff.titulo = t;
    if (e !== (ouv.empresa_nombre ?? '').trim()) diff.empresa_nombre = e;
    if (segmento !== ouv.segmento) diff.segmento = segmento;
    if (vertical !== ouv.vertical) diff.vertical = vertical;
    if (d !== (ouv.descripcion ?? '').trim()) diff.descripcion = d;
    return diff;
  }, [titulo, empresa, segmento, vertical, descripcion, ouv]);

  const hasChanges = Object.keys(payload).length > 0;
  const canSave = hasChanges && titulo.trim() !== '' && empresa.trim() !== '';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await save(payload);
      onSaved(updated);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'No se pudo actualizar la OUV.');
      } else {
        setError('No se pudo actualizar la OUV.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Editar OUV" onClose={onClose} size="wide">
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="edit-ouv-consecutivo">
              Consecutivo
            </label>
            <input
              id="edit-ouv-consecutivo"
              className={`${readonlyInputClass} font-mono`}
              value={ouv.consecutivo}
              readOnly
              disabled
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="edit-ouv-zona">
              Zona
            </label>
            <input
              id="edit-ouv-zona"
              className={readonlyInputClass}
              value={OUV_ZONA_LABEL[ouv.zona_actual] ?? ouv.zona_actual}
              readOnly
              disabled
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="edit-ouv-resultado">
              Estado OUV
            </label>
            <input
              id="edit-ouv-resultado"
              className={readonlyInputClass}
              value={OUV_RESULTADO_LABEL[ouv.resultado] ?? ouv.resultado}
              readOnly
              disabled
            />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="edit-ouv-titulo">
            Título
          </label>
          <input
            id="edit-ouv-titulo"
            className={inputClass}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={200}
            required
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="edit-ouv-empresa">
            Organización
          </label>
          <input
            id="edit-ouv-empresa"
            className={inputClass}
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            maxLength={200}
            required
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="edit-ouv-segmento">
              Segmento
            </label>
            <select
              id="edit-ouv-segmento"
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
            <label className={labelClass} htmlFor="edit-ouv-vertical">
              Vertical
            </label>
            <select
              id="edit-ouv-vertical"
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
          <label className={labelClass} htmlFor="edit-ouv-descripcion">
            Descripción
          </label>
          <textarea
            id="edit-ouv-descripcion"
            className={`${inputClass} h-24 resize-y py-2`}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>

        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            className={ghostButtonClass}
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className={primaryButtonClass}
            disabled={!canSave || saving}
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
