import type { FormEvent } from 'react';
import { useState } from 'react';
import type { CaslPermissionRule, Role } from '../types';
import { getFormErrorMessage } from '../lib/form-errors';

type RoleEditModalProps = {
  open: boolean;
  role: Role | null;
  onClose: () => void;
  onSubmit: (payload: { description?: string; permissions: CaslPermissionRule[] }) => Promise<void>;
};

export function RoleEditModal({ open, role, onClose, onSubmit }: RoleEditModalProps) {
  if (!open || !role) {
    return null;
  }

  return (
    <RoleEditModalBody
      key={role.role_id}
      role={role}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function RoleEditModalBody({
  role,
  onClose,
  onSubmit,
}: Omit<RoleEditModalProps, 'open' | 'role'> & { role: Role }) {
  const [description, setDescription] = useState(role.description ?? '');
  const [permissionsJson, setPermissionsJson] = useState(
    JSON.stringify(role.permissions, null, 2),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    let permissions: CaslPermissionRule[];
    try {
      permissions = JSON.parse(permissionsJson) as CaslPermissionRule[];
      if (!Array.isArray(permissions)) {
        throw new Error('Invalid permissions');
      }
    } catch {
      setError('El JSON de permisos no es válido. Revisa el formato.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        description: description.trim() || undefined,
        permissions,
      });
      onClose();
    } catch (submitError) {
      setError(getFormErrorMessage(submitError, 'No se pudo actualizar el rol.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded bg-surface shadow-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-bold text-ink">Editar rol — {role.name}</h2>
          <p className="mt-1 text-xs text-muted">
            Permisos CASL (action, subject, conditions opcional).
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-4 overflow-y-auto px-6 py-4">
            <div>
              <label htmlFor="role-description" className="mb-1 block text-sm font-bold text-ink">
                Descripción
              </label>
              <input
                id="role-description"
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="h-10 w-full rounded border border-border bg-bg px-3 text-sm text-ink outline-none focus:border-brand focus:bg-surface"
              />
            </div>

            <div>
              <label htmlFor="role-permissions" className="mb-1 block text-sm font-bold text-ink">
                Permisos (JSON)
              </label>
              <textarea
                id="role-permissions"
                rows={14}
                value={permissionsJson}
                onChange={(event) => setPermissionsJson(event.target.value)}
                className="w-full rounded border border-border bg-bg px-3 py-2 font-mono text-xs text-ink outline-none focus:border-brand focus:bg-surface"
                spellCheck={false}
              />
            </div>

            {error ? (
              <p className="rounded-sm bg-bg px-3 py-2 text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
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
