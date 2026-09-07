import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import type { CaslPermissionRule, Role } from '../types';
import { getFormErrorMessage } from '../lib/form-errors';
import {
  ACTION_LABEL,
  PERMISSION_MODULES,
  buildFullCatalogPermissions,
  moduleEnabledCount,
  permissionKey,
  permissionsToSet,
  setToPermissions,
  type PermissionAction,
  type PermissionModuleDef,
} from '../lib/permission-catalog';

type RoleEditModalProps = {
  open: boolean;
  role: Role | null;
  onClose: () => void;
  onSubmit: (payload: {
    description?: string;
    permissions: CaslPermissionRule[];
  }) => Promise<void>;
};

export function RoleEditModal({
  open,
  role,
  onClose,
  onSubmit,
}: RoleEditModalProps) {
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
  const isAdmin = role.name === 'Admin';
  const [activeModuleId, setActiveModuleId] = useState(
    PERMISSION_MODULES[0]?.id ?? '',
  );
  const [enabled, setEnabled] = useState<Set<string>>(() =>
    isAdmin
      ? permissionsToSet(buildFullCatalogPermissions())
      : permissionsToSet(role.permissions),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeModule = useMemo(
    () =>
      PERMISSION_MODULES.find((module) => module.id === activeModuleId) ??
      PERMISSION_MODULES[0],
    [activeModuleId],
  );

  function toggle(action: PermissionAction, subject: string) {
    if (isAdmin) return;
    const key = permissionKey(action, subject);
    setEnabled((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function setModuleAll(module: PermissionModuleDef, on: boolean) {
    if (isAdmin) return;
    setEnabled((current) => {
      const next = new Set(current);
      for (const subject of module.subjects) {
        for (const action of subject.actions) {
          const key = permissionKey(action, subject.subject);
          if (on) next.add(key);
          else next.delete(key);
        }
      }
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const permissions = isAdmin
        ? buildFullCatalogPermissions()
        : setToPermissions(enabled);
      await onSubmit({
        permissions,
      });
      onClose();
    } catch (submitError) {
      setError(
        getFormErrorMessage(submitError, 'No se pudo actualizar el rol.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded bg-surface shadow-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-bold text-ink">
            Editar rol — {role.name}
          </h2>
          <p className="mt-1 text-xs text-muted">
            Activa o desactiva accesos por módulo (crear, ver, editar,
            eliminar).
            {isAdmin
              ? ' Admin conserva acceso completo a todos los módulos.'
              : null}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            <aside className="w-56 shrink-0 overflow-y-auto border-r border-border bg-surface">
              <nav className="flex flex-col p-2" aria-label="Módulos">
                {PERMISSION_MODULES.map((module) => {
                  const { on, total } = moduleEnabledCount(module, enabled);
                  const active = module.id === activeModule?.id;
                  return (
                    <button
                      key={module.id}
                      type="button"
                      onClick={() => setActiveModuleId(module.id)}
                      className={[
                        'mb-1 rounded px-3 py-2 text-left text-sm transition',
                        active
                          ? 'bg-bg font-bold text-accent'
                          : 'text-ink hover:bg-bg',
                      ].join(' ')}
                    >
                      <span className="block">{module.label}</span>
                      <span className="mt-0.5 block text-[11px] font-normal text-muted">
                        {on}/{total} permisos
                      </span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            <div className="min-h-0 flex-1 overflow-y-auto bg-bg px-6 py-4">
              {activeModule ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-ink">
                        {activeModule.label}
                      </h3>
                      <p className="mt-1 text-xs text-muted">
                        {activeModule.description}
                      </p>
                    </div>
                    {!isAdmin ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-glow-outline rounded px-3 py-1.5 text-xs font-bold"
                          onClick={() => setModuleAll(activeModule, true)}
                        >
                          Activar todo
                        </button>
                        <button
                          type="button"
                          className="btn-glow-outline rounded px-3 py-1.5 text-xs font-bold"
                          onClick={() => setModuleAll(activeModule, false)}
                        >
                          Desactivar todo
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {activeModule.subjects.map((subject) => (
                    <div
                      key={subject.subject}
                      className="rounded border border-border bg-surface p-4"
                    >
                      <p className="mb-3 text-sm font-bold text-ink">
                        {subject.label}
                        <span className="ml-2 font-mono text-xs font-normal text-muted">
                          {subject.subject}
                        </span>
                      </p>
                      <div className="flex flex-col gap-2">
                        {subject.actions.map((action) => {
                          const key = permissionKey(action, subject.subject);
                          const checked = enabled.has(key);
                          const id = `perm-${subject.subject}-${action}`;
                          return (
                            <label
                              key={key}
                              htmlFor={id}
                              className={[
                                'inline-flex items-center gap-2 text-sm',
                                isAdmin
                                  ? 'cursor-default text-muted'
                                  : 'cursor-pointer text-ink',
                              ].join(' ')}
                            >
                              <input
                                id={id}
                                type="checkbox"
                                checked={checked}
                                disabled={isAdmin}
                                onChange={() =>
                                  toggle(action, subject.subject)
                                }
                                className="h-4 w-4"
                              />
                              {ACTION_LABEL[action]}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {error ? (
                <p
                  className="mt-4 rounded-sm bg-surface px-3 py-2 text-sm text-danger"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
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
      </div>
    </div>
  );
}
