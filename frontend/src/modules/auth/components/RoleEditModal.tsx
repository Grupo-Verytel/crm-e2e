import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CaslPermissionRule, Role } from '../types';
import { getFormErrorMessage } from '../lib/form-errors';
import {
  ACTION_LABEL,
  PERMISSION_MODULES,
  buildFullCatalogPermissions,
  isDirectorMercadeoRole,
  isGestorMercadeoRole,
  isSoporteComercialRole,
  isEjecutivoComercialRole,
  isPmoRole,
  isPreventaRole,
  isModuleLockedOff,
  isPermissionLockedOff,
  moduleEnabledCount,
  normalizeRoleKey,
  permissionKey,
  permissionsToSet,
  setToPermissions,
  stripLockedOffPermissions,
  type PermissionAction,
  type PermissionModuleDef,
} from '../lib/permission-catalog';

const inputClass =
  'h-9 w-full rounded border border-border bg-bg px-3 text-sm text-ink outline-none focus:border-accent focus:bg-surface';

type RoleModalMode = 'create' | 'edit';

type RoleEditModalProps = {
  open: boolean;
  mode: RoleModalMode;
  role: Role | null;
  existingRoleNames?: string[];
  onClose: () => void;
  onSubmit: (payload: {
    name?: string;
    description?: string;
    permissions: CaslPermissionRule[];
  }) => Promise<void>;
};

export function RoleEditModal({
  open,
  mode,
  role,
  existingRoleNames = [],
  onClose,
  onSubmit,
}: RoleEditModalProps) {
  if (!open) {
    return null;
  }
  if (mode === 'edit' && !role) {
    return null;
  }

  return (
    <RoleEditModalBody
      key={mode === 'create' ? 'create' : role?.role_id}
      mode={mode}
      role={role}
      existingRoleNames={existingRoleNames}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function RoleEditModalBody({
  mode,
  role,
  existingRoleNames = [],
  onClose,
  onSubmit,
}: Omit<RoleEditModalProps, 'open'>) {
  const isCreate = mode === 'create';
  const isAdmin = !isCreate && role?.name === 'Admin';
  const roleName = isCreate ? undefined : role?.name;
  const isDirectorMercadeo = isDirectorMercadeoRole(roleName);
  const isGestorMercadeo = isGestorMercadeoRole(roleName);
  const isSoporteComercial = isSoporteComercialRole(roleName);
  const isEjecutivoComercial = isEjecutivoComercialRole(roleName);
  const isPmo = isPmoRole(roleName);
  const isPreventa = isPreventaRole(roleName);
  const [name, setName] = useState(role?.name ?? '');
  const [activeModuleId, setActiveModuleId] = useState(
    PERMISSION_MODULES[0]?.id ?? '',
  );
  const [enabled, setEnabled] = useState<Set<string>>(() =>
    isAdmin
      ? permissionsToSet(buildFullCatalogPermissions())
      : stripLockedOffPermissions(
          roleName,
          permissionsToSet(role?.permissions ?? []),
        ),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeModule = useMemo(
    () =>
      PERMISSION_MODULES.find((module) => module.id === activeModuleId) ??
      PERMISSION_MODULES[0],
    [activeModuleId],
  );

  const trimmedName = name.trim();
  const nameTaken = existingRoleNames.some(
    (existing) => normalizeRoleKey(existing) === normalizeRoleKey(trimmedName),
  );
  const hasModuleAccess = PERMISSION_MODULES.some(
    (module) => moduleEnabledCount(module, enabled).on > 0,
  );
  const hasSubmodulePermission = enabled.size > 0;
  const canCreate =
    trimmedName.length >= 2 &&
    !nameTaken &&
    hasModuleAccess &&
    hasSubmodulePermission;

  function toggle(action: PermissionAction, subject: string) {
    if (isAdmin || isPermissionLockedOff(roleName, action, subject)) return;
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
    if (isAdmin || isModuleLockedOff(roleName, module.id)) return;
    setEnabled((current) => {
      const next = new Set(current);
      for (const subject of module.subjects) {
        for (const action of subject.actions) {
          if (isPermissionLockedOff(roleName, action, subject.subject)) {
            continue;
          }
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
    if (isCreate && !canCreate) {
      return;
    }
    setIsSubmitting(true);
    try {
      const permissions = isAdmin
        ? buildFullCatalogPermissions()
        : setToPermissions(stripLockedOffPermissions(roleName, enabled));
      await onSubmit({
        name: isCreate ? name.trim() : undefined,
        permissions,
      });
      onClose();
    } catch (submitError) {
      setError(
        getFormErrorMessage(
          submitError,
          isCreate
            ? 'No se pudo crear el rol.'
            : 'No se pudo actualizar el rol.',
        ),
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
            {isCreate ? 'Nuevo rol' : `Editar rol — ${role?.name ?? ''}`}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {isCreate
              ? 'Nombra el rol y marca los módulos a los que puede acceder. Luego ajusta crear, ver, editar y eliminar.'
              : 'Marca los módulos a los que puede acceder. Luego ajusta crear, ver, editar y eliminar.'}
            {isAdmin
              ? ' Admin conserva acceso completo a todos los módulos.'
              : isDirectorMercadeo
                ? ' Puedes parametrizar Leads, Calificación, Empresas, Contactos e Implementación (solo Ver y CSAT). OUV queda en solo Ver. Preventa, Pricing, Oferta, Posventa y el resto quedan en gris.'
                : isGestorMercadeo
                  ? ' Puedes parametrizar Leads y campañas. OUV queda en solo Ver. No hay MQL ni Calificación; el resto de módulos queda en gris.'
                  : isSoporteComercial
                    ? ' Leads con todas las opciones. Calificación: Ver y Asignar, sin crear OUV. OUV: solo Ver. Oferta & Cierre: Kickoff y crear proyecto SER. Implementación solo Ver, sin ampliar ni CSAT. Empresas y Contactos con los botones del listado. El resto queda en gris.'
                    : isEjecutivoComercial
                      ? ' Leads y campañas como Gestor (crear, ver, editar). No aprueba MQL. Calificación: Ver y Crear OUV; Asignar es de Soporte. OUV operativa. Implementación solo Ver. Empresas y Contactos para nutrir leads. El resto queda en gris.'
                      : isPmo
                        ? ' Solo Implementación: Ver SER y Editar (ampliar proyecto). Empresas, Contactos y el resto de módulos quedan en gris.'
                      : isPreventa
                        ? ' Solo OUV en Ver. Las solicitudes de Preventa se consultan en el detalle, sin crear ni eliminar. El resto queda en gris.'
                      : null}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            <aside className="w-80 shrink-0 overflow-y-auto border-r border-border bg-surface">
              {isCreate ? (
                <div className="border-b border-border px-3 py-3">
                  <label className="mb-1 block text-xs font-bold text-ink" htmlFor="role-name">
                    Nombre
                  </label>
                  <input
                    id="role-name"
                    className={inputClass}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ej. CoordinadorPMO"
                    maxLength={60}
                    required
                  />
                  {trimmedName.length >= 2 && nameTaken ? (
                    <p className="mt-1 text-xs text-danger">
                      Ya existe un rol con ese nombre.
                    </p>
                  ) : null}
                </div>
              ) : null}
              <nav className="flex flex-col p-2" aria-label="Módulos">
                {PERMISSION_MODULES.map((module) => (
                  <ModuleAccessRow
                    key={module.id}
                    module={module}
                    enabled={enabled}
                    active={module.id === activeModule?.id}
                    disabled={
                      isAdmin || isModuleLockedOff(roleName, module.id)
                    }
                    onSelect={() => setActiveModuleId(module.id)}
                    onToggleAccess={(on) => setModuleAll(module, on)}
                  />
                ))}
              </nav>
            </aside>

            <div className="min-h-0 flex-1 overflow-y-auto bg-bg px-6 py-4">
              {activeModule ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-ink">
                      {activeModule.label}
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      {activeModule.description}
                    </p>
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
                          const lockedOff = isPermissionLockedOff(
                            roleName,
                            action,
                            subject.subject,
                          );
                          const id = `perm-${subject.subject}-${action}`;
                          return (
                            <label
                              key={key}
                              htmlFor={id}
                              className={[
                                'inline-flex items-center gap-2 text-sm',
                                isAdmin || lockedOff
                                  ? 'cursor-not-allowed text-muted opacity-40'
                                  : 'cursor-pointer text-ink',
                              ].join(' ')}
                            >
                              <input
                                id={id}
                                type="checkbox"
                                checked={checked}
                                disabled={isAdmin || lockedOff}
                                onChange={() =>
                                  toggle(action, subject.subject)
                                }
                                className="h-4 w-4 accent-accent disabled:opacity-40"
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
              disabled={isSubmitting || (isCreate && !canCreate)}
              className="btn-glow rounded px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {isSubmitting ? 'Guardando…' : isCreate ? 'Crear' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModuleAccessRow({
  module,
  enabled,
  active,
  disabled,
  onSelect,
  onToggleAccess,
}: {
  module: PermissionModuleDef;
  enabled: Set<string>;
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
  onToggleAccess: (on: boolean) => void;
}) {
  const { on, total } = moduleEnabledCount(module, enabled);
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = on > 0 && on < total;
    }
  }, [on, total]);

  return (
    <div
      className={[
        'mb-1 flex items-start gap-2 rounded px-2 py-2',
        disabled ? 'opacity-40' : '',
        active ? 'bg-bg' : disabled ? '' : 'hover:bg-bg',
      ].join(' ')}
    >
      <input
        ref={checkboxRef}
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 accent-accent disabled:opacity-40"
        checked={on === total && total > 0}
        disabled={disabled}
        aria-label={`Acceso a ${module.label}`}
        onChange={(event) => onToggleAccess(event.target.checked)}
        onClick={(event) => event.stopPropagation()}
      />
      <button
        type="button"
        onClick={onSelect}
        className={[
          'min-w-0 flex-1 text-left text-sm transition',
          disabled
            ? 'cursor-default text-muted'
            : active
              ? 'font-bold text-accent'
              : 'text-ink',
        ].join(' ')}
      >
        <span className="block">{module.label}</span>
        <span className="mt-0.5 block text-[11px] font-normal text-muted">
          {on}/{total} permisos
        </span>
      </button>
    </div>
  );
}
