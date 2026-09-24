import { useEffect, useState } from 'react';
import { ModalShell } from './ModalShell';
import { ghostButtonClass, primaryButtonClass } from './ui';

type Props = {
  nombre: string;
  tipoLabel: string;
  consecutivo: string;
  initialNotas: string;
  saving: boolean;
  onClose: () => void;
  onSave: (notas: string) => void;
};

export function InfluenciaNotaModal({
  nombre,
  tipoLabel,
  consecutivo,
  initialNotas,
  saving,
  onClose,
  onSave,
}: Props) {
  const [notas, setNotas] = useState(initialNotas);
  const dirty = notas !== initialNotas;

  function requestClose() {
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Cerrar la nota?')) {
      return;
    }
    onClose();
  }

  useEffect(() => {
    const field = document.getElementById('influencia-nota-texto');
    if (field instanceof HTMLTextAreaElement) field.focus();
  }, []);

  return (
    <ModalShell title={`Nota — ${nombre}`} onClose={requestClose}>
      <p className="mb-3 text-xs text-muted">
        {tipoLabel} · {consecutivo}
      </p>
      <textarea
        id="influencia-nota-texto"
        className="h-28 w-full rounded border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        maxLength={1000}
        value={notas}
        onChange={(event) => setNotas(event.target.value)}
      />
      <p className="mt-1 text-right text-xs text-muted">{notas.length}/1000</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className={ghostButtonClass} onClick={requestClose}>
          Cancelar
        </button>
        <button
          type="button"
          className={primaryButtonClass}
          disabled={saving}
          onClick={() => onSave(notas.trim())}
        >
          Guardar
        </button>
      </div>
    </ModalShell>
  );
}
