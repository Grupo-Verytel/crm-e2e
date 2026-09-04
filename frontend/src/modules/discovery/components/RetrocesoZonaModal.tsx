import { useState } from 'react';
import { ApiError } from '../../auth/types';
import { retrocederOuv, type Ouv } from '../api/ouvs-api';
import { OUV_ZONA_LABEL, prevOuvZona } from '../lib/ouv-vocab';
import { ModalShell } from './ModalShell';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

type Props = {
  ouv: Ouv;
  onClose: () => void;
  onRetrocedido: () => void;
};

export function RetrocesoZonaModal({ ouv, onClose, onRetrocedido }: Props) {
  const destino = prevOuvZona(ouv.zona_actual);
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!destino) {
    return (
      <ModalShell title="Retroceder zona" onClose={onClose}>
        <p className="text-sm text-muted">
          No se puede retroceder desde Universo. Usa Descartada.
        </p>
        <div className="mt-4 flex justify-end">
          <button type="button" className={ghostButtonClass} onClick={onClose}>
            Cancelar
          </button>
        </div>
      </ModalShell>
    );
  }

  async function confirm() {
    if (!motivo.trim()) {
      setError('El motivo es obligatorio.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await retrocederOuv(ouv.ouv_id, motivo.trim());
      onRetrocedido();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo retroceder de zona.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Confirmar retroceso" onClose={onClose}>
      <p className="mb-3 text-sm text-ink">
        {OUV_ZONA_LABEL[ouv.zona_actual]} →{' '}
        <strong>{OUV_ZONA_LABEL[destino]}</strong>
      </p>
      <label className={labelClass} htmlFor="retro-motivo">
        Motivo
      </label>
      <textarea
        id="retro-motivo"
        className={`${inputClass} h-24 py-2`}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Explica por qué se degrada la zona"
        required
      />
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className={ghostButtonClass} onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className={primaryButtonClass}
          disabled={saving}
          onClick={() => void confirm()}
        >
          {saving ? 'Guardando…' : 'Confirmar retroceso'}
        </button>
      </div>
    </ModalShell>
  );
}
