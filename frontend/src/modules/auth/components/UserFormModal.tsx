import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import type { Role, User } from '../types';
import { getFormErrorMessage } from '../lib/form-errors';

type UserFormModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  roles: Role[];
  user?: User;
  onClose: () => void;
  onSubmit: (payload: {
    email: string;
    password?: string;
    full_name: string;
    role_id: string;
    is_active: boolean;
  }) => Promise<void>;
};

export function UserFormModal(props: UserFormModalProps) {
  if (!props.open) {
    return null;
  }

  const formKey =
    props.mode === 'create' ? 'create' : (props.user?.user_id ?? 'edit');

  return <UserFormModalBody key={formKey} {...props} />;
}

function UserFormModalBody({
  mode,
  roles,
  user,
  onClose,
  onSubmit,
}: UserFormModalProps) {
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [roleId, setRoleId] = useState(user?.role_id ?? roles[0]?.role_id ?? '');
  const [isActive, setIsActive] = useState(user?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit({
        email: email.trim(),
        password: password || undefined,
        full_name: fullName.trim(),
        role_id: roleId,
        is_active: isActive,
      });
      onClose();
    } catch (submitError) {
      setError(
        getFormErrorMessage(
          submitError,
          mode === 'create'
            ? 'No se pudo crear el usuario.'
            : 'No se pudo actualizar el usuario.',
        ),
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
        aria-labelledby="user-form-title"
      >
        <div className="border-b border-border px-6 py-4">
          <h2 id="user-form-title" className="text-sm font-bold text-ink">
            {mode === 'create' ? 'Nuevo usuario' : 'Editar usuario'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          <Field label="Correo" id="user-email">
            <input
              id="user-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Nombre completo" id="user-full-name">
            <input
              id="user-full-name"
              type="text"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field
            label={mode === 'create' ? 'Contraseña' : 'Contraseña (opcional)'}
            id="user-password"
          >
            <input
              id="user-password"
              type="password"
              required={mode === 'create'}
              minLength={mode === 'create' ? 8 : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
              placeholder={mode === 'edit' ? 'Dejar vacío para no cambiar' : ''}
            />
          </Field>

          <Field label="Rol" id="user-role">
            <select
              id="user-role"
              required
              value={roleId}
              onChange={(event) => setRoleId(event.target.value)}
              className={inputClass}
            >
              {roles.map((role) => (
                <option key={role.role_id} value={role.role_id}>
                  {role.name}
                </option>
              ))}
            </select>
          </Field>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            Usuario activo
          </label>

          {error ? (
            <p className="rounded-sm bg-bg px-3 py-2 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-4 py-2 text-sm text-ink hover:bg-bg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {isSubmitting ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-bold text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  'h-10 w-full rounded border border-border bg-bg px-3 text-sm text-ink outline-none focus:border-brand focus:bg-surface';
