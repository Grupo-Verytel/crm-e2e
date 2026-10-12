import { useState } from 'react';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

type Created = { id: string; nit: string; nombre: string };

type Props = {
  title: string;
  nitId: string;
  nombreId: string;
  onClose: () => void;
  onCreate: (input: { nit: string; nombre: string }) => Created;
  onCreated: (row: Created) => void;
};

export function CrearEmpresaExternaModal({
  title,
  nitId,
  nombreId,
  onClose,
  onCreate,
  onCreated,
}: Props) {
  const [nit, setNit] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    try {
      setError(null);
      onCreated(onCreate({ nit, nombre }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded bg-surface shadow-card"
        role="dialog"
        aria-labelledby={`${nitId}-title`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b border-border px-5 py-4">
          <h2 id={`${nitId}-title`} className="text-base font-bold text-ink">
            {title}
          </h2>
        </header>
        <div className="space-y-3 px-5 py-4">
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div>
            <label className={labelClass} htmlFor={nitId}>
              NIT
            </label>
            <input
              id={nitId}
              className={inputClass}
              value={nit}
              onChange={(event) => setNit(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={nombreId}>
              Nombre
            </label>
            <input
              id={nombreId}
              className={inputClass}
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" className={ghostButtonClass} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={primaryButtonClass} onClick={handleSubmit}>
            Crear
          </button>
        </footer>
      </div>
    </div>
  );
}
