import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { changePasswordRequest } from '../api/auth-api';
import { getFormErrorMessage } from '../lib/form-errors';

type ChangePasswordModalProps = {
  open: boolean;
  onClose: () => void;
};

export function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
  if (!open) {
    return null;
  }

  return <ChangePasswordModalBody onClose={onClose} />;
}

function ChangePasswordModalBody({ onClose }: { onClose: () => void }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('La confirmación no coincide con la nueva contraseña.');
      return;
    }

    setIsSubmitting(true);
    try {
      await changePasswordRequest({
        new_password: newPassword,
      });
      setSaved(true);
    } catch (submitError) {
      setError(
        getFormErrorMessage(submitError, 'No se pudo cambiar la contraseña.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-4">
      <div
        className="w-full max-w-lg rounded bg-surface shadow-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
      >
        <div className="border-b border-border px-6 py-4">
          <h2 id="change-password-title" className="text-sm font-bold text-ink">
            Cambiar contraseña
          </h2>
        </div>

        {saved ? (
          <div className="space-y-4 px-6 py-4">
            <p className="text-sm text-ink" role="status">
              Contraseña actualizada. Úsala la próxima vez que inicies sesión.
            </p>
            <div className="flex justify-end border-t border-border pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-glow rounded px-4 py-2 text-sm font-bold text-white"
              >
                Listo
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
            <PasswordField
              label="Nueva contraseña"
              id="new-password"
              value={newPassword}
              onChange={setNewPassword}
            />

            <PasswordField
              label="Confirmar nueva contraseña"
              id="confirm-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
            />

            {error ? (
              <p className="rounded-sm bg-bg px-3 py-2 text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-glow-outline rounded px-4 py-2 text-sm font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-glow rounded px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {isSubmitting ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function PasswordField({
  label,
  id,
  value,
  onChange,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-bold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          required
          minLength={8}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} pr-10`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="icon-btn absolute inset-y-0 right-0 grid w-10 place-items-center rounded"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
        >
          {visible ? (
            <EyeOff size={16} strokeWidth={1.75} />
          ) : (
            <Eye size={16} strokeWidth={1.75} />
          )}
        </button>
      </div>
    </div>
  );
}

const inputClass =
  'h-10 w-full rounded border border-border bg-bg px-3 text-sm text-ink outline-none focus:border-accent focus:bg-surface';
