import { useState } from 'react';
import {
  createEmpresaExterna,
  type EmpresaExterna,
  type EmpresaExternaKind,
} from '../api/executing-companies-api';
import { errorNit } from '../lib/nit';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

type Props = {
  kind: EmpresaExternaKind;
  title: string;
  onClose: () => void;
  onCreated: (creada: EmpresaExterna) => void;
};

/** Alta de una unión temporal o un aliado: NIT con DV y nombre. */
export function CrearEmpresaExternaModal({
  kind,
  title,
  onClose,
  onCreated,
}: Props) {
  const [nit, setNit] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const idBase = kind === 'UT' ? 'ut' : 'aliado';

  async function handleSubmit() {
    const nitInvalido = errorNit(nit);
    if (nitInvalido) {
      setError(nitInvalido);
      return;
    }
    if (!nombre.trim()) {
      setError('Nombre requerido');
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      onCreated(await createEmpresaExterna(kind, { nit, nombre: nombre.trim() }));
    } catch (err) {
      // 409: el NIT ya existe; 400: el backend rechazó el NIT. El mensaje del
      // backend ya dice cuál.
      setError(err instanceof Error ? err.message : 'No se pudo crear.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      role="presentation"
      onClick={guardando ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded bg-surface shadow-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${idBase}-crear-title`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b border-border px-5 py-4">
          <h2
            id={`${idBase}-crear-title`}
            className="text-base font-bold text-ink"
          >
            Crear {title.toLowerCase()}
          </h2>
        </header>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="space-y-3 px-5 py-4">
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <div>
              <label className={labelClass} htmlFor={`${idBase}-nit`}>
                NIT
              </label>
              <input
                id={`${idBase}-nit`}
                className={inputClass}
                value={nit}
                placeholder="900123456-7"
                onChange={(event) => setNit(event.target.value)}
                autoComplete="off"
                disabled={guardando}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`${idBase}-nombre`}>
                Nombre
              </label>
              <input
                id={`${idBase}-nombre`}
                className={inputClass}
                value={nombre}
                maxLength={160}
                onChange={(event) => setNombre(event.target.value)}
                autoComplete="off"
                disabled={guardando}
              />
            </div>
          </div>
          <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
            <button
              type="button"
              className={ghostButtonClass}
              onClick={onClose}
              disabled={guardando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={primaryButtonClass}
              disabled={guardando}
            >
              {guardando ? 'Creando…' : 'Crear'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
