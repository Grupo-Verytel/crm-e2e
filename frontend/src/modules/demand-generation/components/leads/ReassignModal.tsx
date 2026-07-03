import { useState } from 'react';
import { ModalShell } from '../ModalShell';
import { ghostButtonClass, inputClass, labelClass, primaryButtonClass } from '../ui';

/**
 * Bulk reassignment of the responsible Gestor. The Gestor role cannot list
 * users, so this takes the responsable ID directly (same contract as the filter).
 */
export function ReassignModal({
  count,
  onConfirm,
  onClose,
}: {
  count: number;
  onConfirm: (responsableId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [responsableId, setResponsableId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!responsableId.trim()) {
      setError('Indica el ID del responsable.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(responsableId.trim());
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No se pudo reasignar la selección.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell title={`Reasignar ${count} lead(s)`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label htmlFor="reassign-responsable" className={labelClass}>
            Nuevo responsable (ID)
          </label>
          <input
            id="reassign-responsable"
            value={responsableId}
            onChange={(event) => setResponsableId(event.target.value)}
            placeholder="ID del gestor de mercadeo"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-muted">
            Los leads en aprobación pendiente no se pueden reasignar y se omiten.
          </p>
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
            Reasignar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
