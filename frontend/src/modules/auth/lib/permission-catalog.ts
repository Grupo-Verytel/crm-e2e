import type { CaslPermissionRule } from '../types';

export type PermissionAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'approve'
  | 'schedule'
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
const CRUA: PermissionAction[] = ['create', 'read', 'update', 'approve'];
const CRUD_APPROVE: PermissionAction[] = [
  'create',
  'read',
  'update',
  'delete',
  'approve',
];
const READ: PermissionAction[] = ['read'];
const LEAD_ACTIONS: PermissionAction[] = [
  'create',
  'read',
  'update',
  'delete',
  'approve',
  'schedule',
];
const OUV_ACTIONS: PermissionAction[] = [
  'create',
  'read',
  'update',
  'delete',
  'close',
];

/**
 * Catalog of platform modules for the role permission editor.
 * Order mirrors the app sidebar (NAV_ITEMS); Usuarios y roles stays last.
 * Subjects/actions must match CASL rules used by backend guards and nav.
 */
export const PERMISSION_MODULES: PermissionModuleDef[] = [
  {
    id: 'demand-generation',
    label: 'Leads',
    description: 'Generación de demanda, leads y campañas',
    subjects: [
      { subject: 'Lead', label: 'Leads', actions: LEAD_ACTIONS },
      { subject: 'Campaign', label: 'Campañas', actions: CRUD_APPROVE },
    ],
  },
  {
    id: 'opportunities',
    label: 'Oportunidades (OUV)',
    description: 'Bandeja y detalle de oportunidades comerciales',
    subjects: [
      { subject: 'Opportunity', label: 'OUV', actions: OUV_ACTIONS },
    ],
  },
  {
    id: 'ouv-catalogs',
    label: 'Catálogos OUV',
    description: 'Motivos y plantillas de checklist por zona',
    subjects: [
      {
        subject: 'MotivoPerdida',
        label: 'Motivos de pérdida',
        actions: CRUD,
      },
      {
        subject: 'MotivoDescarte',
        label: 'Motivos de descarte',
        actions: CRUD,
      },
      {
        subject: 'ZonaChecklistTemplate',
        label: 'Plantillas checklist zona',
        actions: CRUD,
      },
    ],
  },
  {
    id: 'presales',
    label: 'Preventa (PRE)',
    description: 'Módulo de Preventa (PRE)',
    subjects: [{ subject: 'Presale', label: 'Preventa', actions: CRUA }],
  },
  {
    id: 'pricing',
    label: 'Pricing (PRI)',
    description: 'Módulo de Pricing (PRI)',
    subjects: [{ subject: 'Pricing', label: 'Pricing', actions: CRUA }],
  },
  {
    id: 'proposals-contracts',
    label: 'Oferta & Cierre',
    description: 'Oferta, cierre y contratos',
    subjects: [
      { subject: 'Proposal', label: 'Propuestas', actions: CRUD_APPROVE },
      { subject: 'Contract', label: 'Contratos', actions: CRUD_APPROVE },
    ],
  },
  {
    id: 'services',
    label: 'Implementación (SER)',
    description: 'Servicios (SER) y kickoff',
    subjects: [
      { subject: 'Service', label: 'Servicios', actions: CRUD_APPROVE },
      { subject: 'Kickoff', label: 'Kickoff', actions: CRUD },
    ],
  },
  {
    id: 'post-sales',
    label: 'Posventa',
    description: 'Seguimiento post-venta',
    subjects: [{ subject: 'PostSale', label: 'Postventa', actions: CRU }],
  },
  {
    id: 'accounts',
    label: 'Empresas y contactos',
    description: 'Empresas (accounts) y personas (people)',
    subjects: [
      { subject: 'Account', label: 'Empresas', actions: CRUD },
      { subject: 'Person', label: 'Contactos', actions: CRUD },
    ],
  },
  {
    id: 'billing',
    label: 'Facturación',
    description: 'Billing y finanzas',
    subjects: [{ subject: 'Billing', label: 'Facturación', actions: CRUA }],
  },
  {
    id: 'audit',
    label: 'Auditoría',
    description: 'Consulta del audit log',
    subjects: [{ subject: 'AuditLog', label: 'Audit log', actions: READ }],
  },
  {
    id: 'users-roles',
    label: 'Usuarios y roles',
    description: 'Administración de usuarios y roles del sistema',
    subjects: [
      { subject: 'User', label: 'Usuarios', actions: CRUD_APPROVE },
      { subject: 'Role', label: 'Roles', actions: CRUD_APPROVE },
    ],
  },
];

export const ACTION_LABEL: Record<PermissionAction, string> = {
  create: 'Crear',
  read: 'Ver',
  update: 'Editar',
  delete: 'Eliminar',
  approve: 'Aprobar',
  schedule: 'Agendar',
  close: 'Cerrar',
};

/** Every rule implied by the catalog (Admin baseline). */
export function buildFullCatalogPermissions(): CaslPermissionRule[] {
  const rules: CaslPermissionRule[] = [];
  for (const module of PERMISSION_MODULES) {
    for (const subject of module.subjects) {
      for (const action of subject.actions) {
        rules.push({ action, subject: subject.subject });
      }
    }
  }
  return rules;
}

export function permissionKey(action: string, subject: string): string {
  return `${action}::${subject}`;
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

/** Modules where the role has at least one catalog permission enabled. */
export function modulesAccessibleByPermissions(
  permissions: CaslPermissionRule[],
): PermissionModuleDef[] {
  const subjects = new Set(permissions.map((rule) => rule.subject));
  return PERMISSION_MODULES.filter((module) =>
    module.subjects.some((subject) => subjects.has(subject.subject)),
  );
}
