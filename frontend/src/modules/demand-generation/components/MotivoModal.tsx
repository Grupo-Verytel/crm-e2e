import { useState } from 'react';
import { ModalShell } from './ModalShell';
import { ghostButtonClass, inputClass, labelClass, primaryButtonClass } from './ui';

export function MotivoModal({
  title,
  confirmLabel,
  onConfirm,
  onClose,
  placeholder = 'Ej. Sin presupuesto este año, no es el decisor, o dato duplicado.',
}: {
  title: string;
  confirmLabel: string;
  onConfirm: (motivo: string) => Promise<void>;
  onClose: () => void;
  placeholder?: string;
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
          : 'No se pudo completar la acción.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell title={title} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label htmlFor="motivo" className={labelClass}>
            Motivo
          </label>
          <textarea
            id="motivo"
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            rows={3}
            placeholder={placeholder}
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
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={primaryButtonClass}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
