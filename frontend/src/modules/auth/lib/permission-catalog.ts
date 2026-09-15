import type { CaslPermissionRule } from '../types';

export type PermissionAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'approve'
  | 'schedule'
  | 'assign'
  | 'close';

export type PermissionSubjectDef = {
  subject: string;
  label: string;
  /** Actions offered in the editor for this subject. */
  actions: PermissionAction[];
};

export type PermissionModuleDef = {
  id: string;
  label: string;
  description: string;
  subjects: PermissionSubjectDef[];
};

const CRUD: PermissionAction[] = ['create', 'read', 'update', 'delete'];
const CRU: PermissionAction[] = ['create', 'read', 'update'];
const READ: PermissionAction[] = ['read'];
const LEAD_ACTIONS: PermissionAction[] = [
  'create',
  'read',
  'update',
  'delete',
  'approve',
  'schedule',
];
const SQL_ACTIONS: PermissionAction[] = ['read', 'assign', 'create'];
const OUV_ACTIONS: PermissionAction[] = [
  'create',
  'read',
  'update',
  'close',
];

/**
 * Catalog of platform modules for the role permission editor.
 * One entry per sidebar item (`NAV_ITEMS`), same order and labels.
 * Subjects/actions must match CASL rules used by backend guards and nav.
 */
export const PERMISSION_MODULES: PermissionModuleDef[] = [
  {
    id: 'demand-generation',
    label: 'Leads',
    description: 'Generación de demanda, leads y campañas',
    subjects: [
      { subject: 'Lead', label: 'Leads', actions: LEAD_ACTIONS },
      { subject: 'Campaign', label: 'Campañas', actions: CRU },
    ],
  },
  {
    id: 'qualification',
    label: 'Calificación',
    description: 'Bandeja SQL: ver, asignar a comercial y crear OUV',
    subjects: [
      { subject: 'Sql', label: 'SQL', actions: SQL_ACTIONS },
    ],
  },
  {
    id: 'discovery',
    label: 'Oportunidades (OUV)',
    description: 'Bandeja OUV, oportunidades perdidas y descartadas',
    subjects: [
      { subject: 'Opportunity', label: 'OUV', actions: OUV_ACTIONS },
    ],
  },
  {
    id: 'technical-feasibility',
    label: 'Preventa (PRE)',
    description: 'Módulo de Preventa (PRE) — placeholder',
    subjects: [{ subject: 'Presale', label: 'Preventa', actions: READ }],
  },
  {
    id: 'pricing',
    label: 'Pricing (PRI)',
    description: 'Módulo de Pricing (PRI) — placeholder',
    subjects: [{ subject: 'Pricing', label: 'Pricing', actions: READ }],
  },
  {
    id: 'offer-closing',
    label: 'Oferta & Cierre',
    description: 'Bandeja de venta ganada, Kickoff y crear proyecto SER',
    subjects: [
      { subject: 'Kickoff', label: 'Kickoff', actions: CRU },
      { subject: 'Service', label: 'Proyecto SER', actions: ['create'] },
    ],
  },
  {
    id: 'implementation',
    label: 'Implementación (SER)',
    description: 'Servicios recibidos desde Oferta & Cierre, CSAT y ampliar',
    subjects: [
      { subject: 'Service', label: 'Servicios', actions: ['read', 'update'] },
      { subject: 'Csat', label: 'CSAT semanal', actions: ['update'] },
    ],
  },
  {
    id: 'post-sales',
    label: 'Posventa',
    description: 'Seguimiento post-venta — placeholder',
    subjects: [{ subject: 'PostSale', label: 'Postventa', actions: READ }],
  },
  {
    id: 'accounts-empresas',
    label: 'Empresas',
    description: 'Maestro de empresas (accounts)',
    subjects: [{ subject: 'Account', label: 'Empresas', actions: CRUD }],
  },
  {
    id: 'accounts-contactos',
    label: 'Contactos',
    description: 'Maestro de personas (people)',
    subjects: [{ subject: 'Person', label: 'Contactos', actions: CRU }],
  },
  {
    id: 'auth',
    label: 'Usuarios y roles',
    description: 'Administración de usuarios y roles del sistema',
    subjects: [
      { subject: 'User', label: 'Usuarios', actions: CRU },
      { subject: 'Role', label: 'Roles', actions: CRU },
    ],
  },
  {
    id: 'audit',
    label: 'Auditoría',
    description: 'Consulta del audit log',
    subjects: [{ subject: 'AuditLog', label: 'Audit log', actions: READ }],
  },
];

export const ACTION_LABEL: Record<PermissionAction, string> = {
  create: 'Crear',
  read: 'Ver',
  update: 'Editar',
  delete: 'Eliminar',
  approve: 'Aprobar',
  schedule: 'Agendar',
  assign: 'Asignar',
  close: 'Cerrar',
};

/**
 * CASL rules required by APIs that are not editor rows.
 * Motivo/checklist catalogs stay as Soporte/Admin pages, not OUV tray toggles.
 */
const HIDDEN_CASL_EXTRAS: CaslPermissionRule[] = [
  { action: 'update', subject: 'Sql' },
  { action: 'delete', subject: 'Person' },
  { action: 'create', subject: 'MotivoPerdida' },
  { action: 'read', subject: 'MotivoPerdida' },
  { action: 'update', subject: 'MotivoPerdida' },
  { action: 'delete', subject: 'MotivoPerdida' },
  { action: 'create', subject: 'MotivoDescarte' },
  { action: 'read', subject: 'MotivoDescarte' },
  { action: 'update', subject: 'MotivoDescarte' },
  { action: 'delete', subject: 'MotivoDescarte' },
  { action: 'create', subject: 'ZonaChecklistTemplate' },
  { action: 'read', subject: 'ZonaChecklistTemplate' },
  { action: 'update', subject: 'ZonaChecklistTemplate' },
  { action: 'delete', subject: 'ZonaChecklistTemplate' },
];

/** Every rule implied by the catalog (Admin baseline), plus API extras. */
export function buildFullCatalogPermissions(): CaslPermissionRule[] {
  const rules: CaslPermissionRule[] = [];
  for (const module of PERMISSION_MODULES) {
    for (const subject of module.subjects) {
      for (const action of subject.actions) {
        rules.push({ action, subject: subject.subject });
      }
    }
  }
  rules.push(...HIDDEN_CASL_EXTRAS);
  return rules;
}

export function permissionKey(action: string, subject: string): string {
  return `${action}::${subject}`;
}

export function hasPermission(
  permissions: CaslPermissionRule[] | undefined,
  action: string,
  subject: string,
): boolean {
  return (
    permissions?.some(
      (rule) => rule.action === action && rule.subject === subject,
    ) ?? false
  );
}

/** Compare role names ignoring spaces, hyphens and underscores. */
export function normalizeRoleKey(name: string): string {
  return name.replace(/[\s_-]/g, '').toLowerCase();
}

export function permissionsToSet(
  permissions: CaslPermissionRule[],
): Set<string> {
  return new Set(
    permissions.map((rule) => permissionKey(rule.action, rule.subject)),
  );
}

export function setToPermissions(enabled: Set<string>): CaslPermissionRule[] {
  const rules: CaslPermissionRule[] = [];
  for (const module of PERMISSION_MODULES) {
    for (const subject of module.subjects) {
      for (const action of subject.actions) {
        const key = permissionKey(action, subject.subject);
        if (enabled.has(key)) {
          rules.push({ action, subject: subject.subject });
        }
      }
    }
  }
  // Preserve unknown rules (not in catalog) so we don't wipe extras on save.
  for (const key of enabled) {
    const [action, subject] = key.split('::');
    if (!action || !subject) continue;
    const inCatalog = PERMISSION_MODULES.some((module) =>
      module.subjects.some(
        (s) => s.subject === subject && s.actions.includes(action as PermissionAction),
      ),
    );
    if (!inCatalog) {
      rules.push({ action, subject });
    }
  }
  return rules;
}

export function moduleEnabledCount(
  module: PermissionModuleDef,
  enabled: Set<string>,
): { on: number; total: number } {
  let total = 0;
  let on = 0;
  for (const subject of module.subjects) {
    for (const action of subject.actions) {
      total += 1;
      if (enabled.has(permissionKey(action, subject.subject))) {
        on += 1;
      }
    }
  }
  return { on, total };
}

const IMPLEMENTATION_SUBJECTS = new Set(['Service', 'Csat']);

/** Modules DirectorMercadeo may parameterize. Others stay gray. */
const DIRECTOR_MERCADEO_PARAMETERIZABLE_MODULES = new Set([
  'demand-generation',
  'qualification',
  'discovery',
  'implementation',
  'accounts-empresas',
  'accounts-contactos',
]);

/** Implementation keys DirectorMercadeo may enable (enter module + CSAT). */
const DIRECTOR_MERCADEO_IMPLEMENTATION_ALLOWED = new Set([
  permissionKey('read', 'Service'),
  permissionKey('update', 'Csat'),
]);

/** OUV: view board, perdidas and descartadas. No create/move/close. */
const DIRECTOR_MERCADEO_DISCOVERY_ALLOWED = new Set([
  permissionKey('read', 'Opportunity'),
]);

export function isDirectorMercadeoRole(roleName: string | undefined): boolean {
  if (!roleName) return false;
  return normalizeRoleKey(roleName) === 'directormercadeo';
}

export function isGestorMercadeoRole(roleName: string | undefined): boolean {
  if (!roleName) return false;
  return normalizeRoleKey(roleName) === 'gestormercadeo';
}

export function isSoporteComercialRole(roleName: string | undefined): boolean {
  if (!roleName) return false;
  return normalizeRoleKey(roleName) === 'soportecomercial';
}

export function isEjecutivoComercialRole(roleName: string | undefined): boolean {
  if (!roleName) return false;
  return normalizeRoleKey(roleName) === 'ejecutivocomercial';
}

export function isPmoRole(roleName: string | undefined): boolean {
  if (!roleName) return false;
  return normalizeRoleKey(roleName) === 'pmo';
}

export function isPreventaRole(roleName: string | undefined): boolean {
  if (!roleName) return false;
  const key = normalizeRoleKey(roleName);
  return key === 'preventa' || key === 'ingenieropreventa';
}

/** spec-calificacion / spec-ouv-funnel + Empresas/Contactos for lead data. */
const SOPORTE_COMERCIAL_PARAMETERIZABLE_MODULES = new Set([
  'demand-generation',
  'qualification',
  'discovery',
  'offer-closing',
  'implementation',
  'accounts-empresas',
  'accounts-contactos',
]);

const SOPORTE_COMERCIAL_ALLOWED = new Set([
  permissionKey('create', 'Lead'),
  permissionKey('read', 'Lead'),
  permissionKey('update', 'Lead'),
  permissionKey('delete', 'Lead'),
  permissionKey('approve', 'Lead'),
  permissionKey('schedule', 'Lead'),
  permissionKey('create', 'Campaign'),
  permissionKey('read', 'Campaign'),
  permissionKey('update', 'Campaign'),
  permissionKey('read', 'Sql'),
  permissionKey('assign', 'Sql'),
  permissionKey('read', 'Opportunity'),
  permissionKey('create', 'MotivoPerdida'),
  permissionKey('read', 'MotivoPerdida'),
  permissionKey('update', 'MotivoPerdida'),
  permissionKey('delete', 'MotivoPerdida'),
  permissionKey('create', 'MotivoDescarte'),
  permissionKey('read', 'MotivoDescarte'),
  permissionKey('update', 'MotivoDescarte'),
  permissionKey('delete', 'MotivoDescarte'),
  permissionKey('create', 'ZonaChecklistTemplate'),
  permissionKey('read', 'ZonaChecklistTemplate'),
  permissionKey('update', 'ZonaChecklistTemplate'),
  permissionKey('delete', 'ZonaChecklistTemplate'),
  permissionKey('create', 'Account'),
  permissionKey('read', 'Account'),
  permissionKey('update', 'Account'),
  permissionKey('delete', 'Account'),
  permissionKey('create', 'Person'),
  permissionKey('read', 'Person'),
  permissionKey('update', 'Person'),
  permissionKey('delete', 'Person'),
  permissionKey('create', 'Proposal'),
  permissionKey('read', 'Proposal'),
  permissionKey('update', 'Proposal'),
  permissionKey('delete', 'Proposal'),
  permissionKey('approve', 'Proposal'),
  permissionKey('create', 'Contract'),
  permissionKey('read', 'Contract'),
  permissionKey('update', 'Contract'),
  permissionKey('delete', 'Contract'),
  permissionKey('approve', 'Contract'),
  permissionKey('create', 'Service'),
  permissionKey('read', 'Service'),
  permissionKey('create', 'Kickoff'),
  permissionKey('read', 'Kickoff'),
  permissionKey('update', 'Kickoff'),
]);

const GESTOR_MERCADEO_PARAMETERIZABLE_MODULES = new Set([
  'demand-generation',
  'discovery',
]);

const GESTOR_MERCADEO_ALLOWED = new Set([
  permissionKey('create', 'Lead'),
  permissionKey('read', 'Lead'),
  permissionKey('update', 'Lead'),
  permissionKey('create', 'Campaign'),
  permissionKey('read', 'Campaign'),
  permissionKey('update', 'Campaign'),
  permissionKey('read', 'Opportunity'),
]);

const EJECUTIVO_COMERCIAL_PARAMETERIZABLE_MODULES = new Set([
  'demand-generation',
  'qualification',
  'discovery',
  'implementation',
  'accounts-empresas',
  'accounts-contactos',
]);

const EJECUTIVO_COMERCIAL_ALLOWED = new Set([
  permissionKey('create', 'Lead'),
  permissionKey('read', 'Lead'),
  permissionKey('update', 'Lead'),
  permissionKey('create', 'Campaign'),
  permissionKey('read', 'Campaign'),
  permissionKey('update', 'Campaign'),
  permissionKey('create', 'Sql'),
  permissionKey('read', 'Sql'),
  permissionKey('update', 'Sql'),
  permissionKey('create', 'Opportunity'),
  permissionKey('read', 'Opportunity'),
  permissionKey('update', 'Opportunity'),
  permissionKey('close', 'Opportunity'),
  permissionKey('read', 'MotivoPerdida'),
  permissionKey('read', 'MotivoDescarte'),
  permissionKey('create', 'Account'),
  permissionKey('read', 'Account'),
  permissionKey('update', 'Account'),
  permissionKey('create', 'Person'),
  permissionKey('read', 'Person'),
  permissionKey('update', 'Person'),
  permissionKey('read', 'Service'),
]);

const PMO_PARAMETERIZABLE_MODULES = new Set(['implementation']);

const PMO_ALLOWED = new Set([
  permissionKey('read', 'Service'),
  permissionKey('update', 'Service'),
]);

const PREVENTA_PARAMETERIZABLE_MODULES = new Set(['discovery']);

const PREVENTA_ALLOWED = new Set([
  permissionKey('read', 'Opportunity'),
]);

export function isModuleLockedOff(
  roleName: string | undefined,
  moduleId: string,
): boolean {
  if (isDirectorMercadeoRole(roleName)) {
    return !DIRECTOR_MERCADEO_PARAMETERIZABLE_MODULES.has(moduleId);
  }
  if (isGestorMercadeoRole(roleName)) {
    return !GESTOR_MERCADEO_PARAMETERIZABLE_MODULES.has(moduleId);
  }
  if (isSoporteComercialRole(roleName)) {
    return !SOPORTE_COMERCIAL_PARAMETERIZABLE_MODULES.has(moduleId);
  }
  if (isEjecutivoComercialRole(roleName)) {
    return !EJECUTIVO_COMERCIAL_PARAMETERIZABLE_MODULES.has(moduleId);
  }
  if (isPmoRole(roleName)) {
    return !PMO_PARAMETERIZABLE_MODULES.has(moduleId);
  }
  if (isPreventaRole(roleName)) {
    return !PREVENTA_PARAMETERIZABLE_MODULES.has(moduleId);
  }
  return false;
}

function moduleIdForActionSubject(
  action: PermissionAction,
  subject: string,
): string | undefined {
  return PERMISSION_MODULES.find((module) =>
    module.subjects.some(
      (item) => item.subject === subject && item.actions.includes(action),
    ),
  )?.id;
}

/** True when this role cannot enable the action (shown gray in the editor). */
export function isPermissionLockedOff(
  roleName: string | undefined,
  action: PermissionAction,
  subject: string,
): boolean {
  if (isDirectorMercadeoRole(roleName)) {
    const moduleId = moduleIdForActionSubject(action, subject);
    if (!moduleId) return true;
    if (isModuleLockedOff(roleName, moduleId)) return true;
    if (moduleId === 'discovery') {
      return !DIRECTOR_MERCADEO_DISCOVERY_ALLOWED.has(
        permissionKey(action, subject),
      );
    }
    if (!IMPLEMENTATION_SUBJECTS.has(subject)) return false;
    return !DIRECTOR_MERCADEO_IMPLEMENTATION_ALLOWED.has(
      permissionKey(action, subject),
    );
  }
  if (isGestorMercadeoRole(roleName)) {
    return !GESTOR_MERCADEO_ALLOWED.has(permissionKey(action, subject));
  }
  if (isSoporteComercialRole(roleName)) {
    return !SOPORTE_COMERCIAL_ALLOWED.has(permissionKey(action, subject));
  }
  if (isEjecutivoComercialRole(roleName)) {
    return !EJECUTIVO_COMERCIAL_ALLOWED.has(permissionKey(action, subject));
  }
  if (isPmoRole(roleName)) {
    return !PMO_ALLOWED.has(permissionKey(action, subject));
  }
  if (isPreventaRole(roleName)) {
    return !PREVENTA_ALLOWED.has(permissionKey(action, subject));
  }
  return false;
}

export function stripLockedOffPermissions(
  roleName: string | undefined,
  enabled: Set<string>,
): Set<string> {
  const next = new Set<string>();
  for (const key of enabled) {
    const [action, subject] = key.split('::');
    if (!action || !subject) continue;
    if (
      isPermissionLockedOff(roleName, action as PermissionAction, subject)
    ) {
      continue;
    }
    next.add(key);
  }
  return next;
}

/** Modules where the role has at least one catalog permission enabled. */
export function modulesAccessibleByPermissions(
  permissions: CaslPermissionRule[],
): PermissionModuleDef[] {
  const subjects = new Set(permissions.map((rule) => rule.subject));
  return PERMISSION_MODULES.filter((module) =>
    module.subjects.some((subject) => subjects.has(subject.subject)),
  );
}
