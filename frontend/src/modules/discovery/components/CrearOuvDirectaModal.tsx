import { useState, type FormEvent } from 'react';
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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const ouv = await crearOuvDirecta({
        titulo: titulo.trim(),
        empresa_nombre: empresa.trim(),
        segmento,
        vertical,
        descripcion: descripcion.trim(),
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
      <div className="w-full max-w-lg rounded bg-surface p-6 shadow-card">
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
            <label className={labelClass} htmlFor="ouv-empresa">
              Empresa
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
