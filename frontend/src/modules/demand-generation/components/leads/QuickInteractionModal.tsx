import { useState } from 'react';
import { registerInteraction } from '../../api/leads-api';
import {
  INTERACTION_CANALES,
  INTERACTION_TIPOS,
  type InteractionCanal,
  type InteractionTipo,
} from '../../types';
import { ModalShell } from '../ModalShell';
import { ghostButtonClass, inputClass, labelClass, primaryButtonClass } from '../ui';

/**
 * Fast interaction capture. Opened when a card is dropped into "En nutrición"
 * without any interaction yet: the gate (DG-12) becomes the action that resolves
 * it, instead of a mute rejection.
 */
export function QuickInteractionModal({
  leadId,
  leadName,
  onRegistered,
  onClose,
}: {
  leadId: string;
  leadName: string;
  onRegistered: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [tipo, setTipo] = useState<InteractionTipo>('Llamada');
  const [canal, setCanal] = useState<InteractionCanal>('Telefono');
  const [descripcion, setDescripcion] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setIsSaving(true);
    setError(null);
    try {
      await registerInteraction(leadId, {
        tipo,
        canal,
        descripcion: descripcion.trim() || undefined,
      });
      await onRegistered();
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No se pudo registrar la interacción.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalShell title="Registrar interacción" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted">
          {leadName} aún no tiene ninguna interacción. Registra la primera para
          moverlo a nutrición.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="qi-tipo" className={labelClass}>
              Tipo
            </label>
            <select
              id="qi-tipo"
              value={tipo}
              onChange={(event) => setTipo(event.target.value as InteractionTipo)}
              className={inputClass}
            >
              {INTERACTION_TIPOS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="qi-canal" className={labelClass}>
              Canal
            </label>
            <select
              id="qi-canal"
              value={canal}
              onChange={(event) => setCanal(event.target.value as InteractionCanal)}
              className={inputClass}
            >
              {INTERACTION_CANALES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="qi-desc" className={labelClass}>
            Descripción (opcional)
          </label>
          <textarea
            id="qi-desc"
            value={descripcion}
            onChange={(event) => setDescripcion(event.target.value)}
            rows={3}
            placeholder="Ej. Llamada inicial: interesado en el portafolio de conectividad."
            className={`${inputClass} h-auto py-2`}
          />
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ghostButtonClass}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className={primaryButtonClass}
          >
            Registrar y mover a nutrición
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
