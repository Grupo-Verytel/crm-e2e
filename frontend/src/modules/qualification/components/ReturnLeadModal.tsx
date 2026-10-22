import { useState } from 'react';
import { ModalShell } from '../../demand-generation/components/ModalShell';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

export function ReturnLeadModal({
  leadLabel,
  onConfirm,
  onClose,
}: {
  leadLabel: string;
  onConfirm: (motivo: string) => Promise<void>;
  onClose: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!motivo.trim()) {
      setError('El motivo es obligatorio.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(motivo.trim());
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No se pudo devolver el lead.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell title="Devolver a leads devueltas" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-ink">
          {leadLabel} pasa a Leads devueltas. El SQL queda en backlog y ya no se
          puede convertir en OUV.
        </p>
        <div>
          <label htmlFor="motivo-devolucion" className={labelClass}>
            Motivo
          </label>
          <textarea
            id="motivo-devolucion"
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            rows={3}
            placeholder="Ej. El contacto no es el decisor, o no hay presupuesto este año."
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
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
            className={primaryButtonClass}
          >
            Devolver
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
