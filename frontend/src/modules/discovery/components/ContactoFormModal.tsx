import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../auth/types';
import type { ContactoPayload, OuvContacto } from '../api/ouvs-api';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

type Props = {
  initial?: OuvContacto | null;
  onClose: () => void;
  onSave: (payload: ContactoPayload) => Promise<void>;
};

export function ContactoFormModal({ initial, onClose, onSave }: Props) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const [cargo, setCargo] = useState(initial?.cargo ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [telefono, setTelefono] = useState(initial?.telefono ?? '');
  const [notas, setNotas] = useState(initial?.notas ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNombre(initial?.nombre ?? '');
    setCargo(initial?.cargo ?? '');
    setEmail(initial?.email ?? '');
    setTelefono(initial?.telefono ?? '');
    setNotas(initial?.notas ?? '');
  }, [initial]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        nombre: nombre.trim(),
        cargo: cargo.trim() || undefined,
        email: email.trim() || undefined,
        telefono: telefono.trim() || undefined,
        notas: notas.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'No se pudo guardar el contacto.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-md rounded bg-surface p-6 shadow-card">
        <h2 className="mb-4 text-lg font-bold text-ink">
          {initial ? 'Editar contacto' : 'Agregar contacto'}
        </h2>
        <form className="space-y-3" onSubmit={onSubmit}>
          <div>
            <label className={labelClass} htmlFor="c-nombre">
              Nombre
            </label>
            <input
              id="c-nombre"
              className={inputClass}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="c-cargo">
              Cargo
            </label>
            <input
              id="c-cargo"
              className={inputClass}
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="c-email">
              Email
            </label>
            <input
              id="c-email"
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="c-tel">
              Teléfono
            </label>
            <input
              id="c-tel"
              className={inputClass}
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="c-notas">
              Notas
            </label>
            <textarea
              id="c-notas"
              className={`${inputClass} h-20 py-2`}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
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
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
