const ACTION_MAP = {
  C: 'create',
  R: 'read',
  U: 'update',
  A: 'approve',
  X: 'close',
  D: 'delete',
  S: 'schedule',
  N: 'assign',
};

const SUBJECTS = {
  'users/roles': ['User', 'Role'],
  'leads/campaigns': ['Lead', 'Campaign'],
  qualification: ['Sql'],
  opportunities: ['Opportunity'],
  csat: ['Csat'],
  accounts: ['Account', 'Person'],
  'ouv-catalogs': [
    'MotivoPerdida',
    'MotivoDescarte',
    'ZonaChecklistTemplate',
  ],
  'ouv-motivos': ['MotivoPerdida', 'MotivoDescarte'],
  presales: ['Presale'],
  pricing: ['Pricing'],
  'proposals/contracts': ['Proposal', 'Contract'],
  services: ['Service'],
  kickoff: ['Kickoff'],
  billing: ['Billing'],
  'post-sales': ['PostSale'],
  'audit-log': ['AuditLog'],
};

/** RBAC matrix §3.1 from spec-auth (keys match Role.name). */
const MATRIX = {
  Admin: {
    'users/roles': 'CRUDAS',
    'leads/campaigns': 'CRUDAS',
    qualification: 'CRUN',
    opportunities: 'CRUDX',
    accounts: 'CRUD',
    'ouv-catalogs': 'CRUD',
    presales: 'CRUAD',
    pricing: 'CRUAD',
    'proposals/contracts': 'CRUDAD',
    services: 'CRUAD',
    kickoff: 'CRUD',
    billing: 'CRUAD',
    'post-sales': 'CRUD',
    csat: 'U',
    'audit-log': 'R',
  },
  DirectorMercadeo: {
    'leads/campaigns': 'CRUA',
    qualification: 'CRU',
    opportunities: 'R',
    accounts: 'CRU',
    services: 'R',
    csat: 'U',
  },
  GestorMercadeo: {
    'leads/campaigns': 'CRU',
    opportunities: 'R',
  },
  EjecutivoComercial: {
    // Same lead/campaign CRU as GestorMercadeo (acuerdo: también crea leads).
    'leads/campaigns': 'CRU',
    // spec-calificacion: Ver + Crear OUV (ruta directa / convertir). Reagendar cita
    // stays as update::Sql (not shown in the role editor).
    qualification: 'CR',
    // spec-auth CRUX + spec-ouv-funnel owner actions. Catalogs CRUD is Soporte.
    opportunities: 'CRUX',
    'ouv-motivos': 'R',
    // Lead/OUV contacts (EARS-37/38, EARS-08). Soft-delete accounts is Soporte.
    accounts: 'CRU',
    // Implementation view-only (spec-auth services R).
    services: 'R',
  },
  ProductManager: {
    'leads/campaigns': 'CRU',
    accounts: 'CRU',
  },
  TraductorDeNegocio: {
    'leads/campaigns': 'R',
    accounts: 'R',
  },
  SoporteComercial: {
    // Leads has no CASL matrix in spec-demand-generation → all catalog options.
    'leads/campaigns': 'CRUDA',
    // spec-calificacion §4: Ver + Asignar. No crear SQL / convertir OUV.
    qualification: 'RN',
    // spec-ouv-funnel §4: view all OUVs; no create/update/close. Catalogs CRUD.
    opportunities: 'R',
    accounts: 'CRUD',
    'ouv-catalogs': 'CRUD',
    'proposals/contracts': 'CRUDA',
    // Crear SER is Oferta; Implementación is view-only (no ampliar, no CSAT).
    services: 'CR',
    kickoff: 'CRU',
  },
  Preventa: {
    // OUV view-only. Solicitudes live in OUV detail (no extra catalog subjects).
    opportunities: 'R',
  },
  Pricing: {
    opportunities: 'R',
    accounts: 'CRU',
    presales: 'R',
    pricing: 'CRUA',
    'proposals/contracts': 'R',
  },
  PMO: {
    // Implementation only: see SER and ampliar. No Empresas/Contactos, Kickoff or placeholders.
    services: 'RU',
  },
  FyA: {
    accounts: 'CRU',
    services: 'R',
    billing: 'CRUA',
  },
  Cliente: {
    accounts: 'CRU',
  },
};

const BASE_ROLES = [
  {
    name: 'Admin',
    description: 'System administrator with full platform access',
  },
  {
    name: 'DirectorMercadeo',
    description: 'Director de Mercadeo — demand generation oversight',
  },
  {
    name: 'GestorMercadeo',
    description: 'Gestor de Mercadeo — campaigns and leads management',
  },
  {
    name: 'EjecutivoComercial',
    description: 'Ejecutivo Comercial — commercial executive (Opportunity owner)',
  },
  {
    name: 'SoporteComercial',
    description: 'Soporte Comercial — commercial support',
  },
  {
    name: 'ProductManager',
    description: 'Product Manager — direct lead creation to MQL_PENDING',
  },
  {
    name: 'TraductorDeNegocio',
    description: 'Traductor de Negocio — read-only referred leads',
  },
  {
    name: 'Preventa',
    description: 'Preventa — technical feasibility and PRE',
  },
  {
    name: 'Pricing',
    description: 'Pricing — PRI and margin analysis',
  },
  {
    name: 'PMO',
    description: 'PMO — implementation and SER lifecycle',
  },
  {
    name: 'FyA',
    description: 'Finanzas y Administración — billing and finance',
  },
  {
    name: 'Cliente',
    description: 'External client portal (limited access — future)',
  },
];

function parsePermissionCodes(permissionCodes) {
  return permissionCodes
    .split('')
    .map((code) => ACTION_MAP[code])
    .filter(Boolean);
}

function buildPermissions(roleName) {
  const roleMatrix = MATRIX[roleName] || {};
  const rules = [];
  const seen = new Set();

  for (const [resource, permissionCodes] of Object.entries(roleMatrix)) {
    if (!permissionCodes) {
      continue;
    }

    const actions = parsePermissionCodes(permissionCodes);
    const subjects = SUBJECTS[resource] || [];

    for (const subject of subjects) {
      for (const action of actions) {
        const key = `${action}::${subject}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rules.push({ action, subject });
      }
    }
  }

  if (roleName === 'SoporteComercial' || roleName === 'Admin') {
    const key = 'schedule::Lead';
    if (!seen.has(key)) {
      rules.push({ action: 'schedule', subject: 'Lead' });
    }
  }

  if (roleName === 'EjecutivoComercial' || roleName === 'Admin') {
    const key = 'update::Sql';
    if (!seen.has(key)) {
      rules.push({ action: 'update', subject: 'Sql' });
    }
  }

  return rules;
}

/** Compare role names ignoring spaces, hyphens and underscores. */
function normalizeRoleKey(name) {
  return String(name || '')
    .replace(/[\s_-]/g, '')
    .toLowerCase();
}

/**
 * DirectorMercadeo may keep only parameterizable modules:
 * Leads, Calificación, OUV (read-only), Empresas,
 * Contactos, Implementación (read Service + CSAT).
 */
const DIRECTOR_MERCADEO_ALLOWED_KEYS = new Set([
  'create::Lead',
  'read::Lead',
  'update::Lead',
  'delete::Lead',
  'approve::Lead',
  'schedule::Lead',
  'create::Campaign',
  'read::Campaign',
  'update::Campaign',
  'delete::Campaign',
  'approve::Campaign',
  'create::Sql',
  'read::Sql',
  'update::Sql',
  'read::Opportunity',
  'create::Account',
  'read::Account',
  'update::Account',
  'delete::Account',
  'create::Person',
  'read::Person',
  'update::Person',
  'delete::Person',
  'read::Service',
  'update::Csat',
]);

function filterDirectorMercadeoPermissions(rules) {
  if (!Array.isArray(rules)) {
    return [];
  }
  const seen = new Set();
  const next = [];
  for (const rule of rules) {
    if (!rule || typeof rule.action !== 'string' || typeof rule.subject !== 'string') {
      continue;
    }
    const key = `${rule.action}::${rule.subject}`;
    if (!DIRECTOR_MERCADEO_ALLOWED_KEYS.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push({ action: rule.action, subject: rule.subject });
  }
  return next;
}

/**
 * GestorMercadeo: Leads + campañas + dashboard (via Lead read). No MQL, no
 * Calificación. OUV view-only. Everything else locked.
 */
const GESTOR_MERCADEO_ALLOWED_KEYS = new Set([
  'create::Lead',
  'read::Lead',
  'update::Lead',
  'create::Campaign',
  'read::Campaign',
  'update::Campaign',
  'read::Opportunity',
]);

function filterGestorMercadeoPermissions(rules) {
  if (!Array.isArray(rules)) {
    return [];
  }
  const seen = new Set();
  const next = [];
  for (const rule of rules) {
    if (!rule || typeof rule.action !== 'string' || typeof rule.subject !== 'string') {
      continue;
    }
    const key = `${rule.action}::${rule.subject}`;
    if (!GESTOR_MERCADEO_ALLOWED_KEYS.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push({ action: rule.action, subject: rule.subject });
  }
  return next;
}

/**
 * SoporteComercial: Leads (all catalog options), Calificación RU, OUV view +
 * catalog CRUD, Empresas/Contactos full CRUD (feeds lead creation). Rest locked.
 */
const SOPORTE_COMERCIAL_ALLOWED_KEYS = new Set([
  'create::Lead',
  'read::Lead',
  'update::Lead',
  'delete::Lead',
  'approve::Lead',
  'schedule::Lead',
  'create::Campaign',
  'read::Campaign',
  'update::Campaign',
  'read::Sql',
  'assign::Sql',
  'read::Opportunity',
  'create::MotivoPerdida',
  'read::MotivoPerdida',
  'update::MotivoPerdida',
  'delete::MotivoPerdida',
  'create::MotivoDescarte',
  'read::MotivoDescarte',
  'update::MotivoDescarte',
  'delete::MotivoDescarte',
  'create::ZonaChecklistTemplate',
  'read::ZonaChecklistTemplate',
  'update::ZonaChecklistTemplate',
  'delete::ZonaChecklistTemplate',
  'create::Account',
  'read::Account',
  'update::Account',
  'delete::Account',
  'create::Person',
  'read::Person',
  'update::Person',
  'delete::Person',
  'create::Proposal',
  'read::Proposal',
  'update::Proposal',
  'delete::Proposal',
  'approve::Proposal',
  'create::Contract',
  'read::Contract',
  'update::Contract',
  'delete::Contract',
  'approve::Contract',
  'create::Service',
  'read::Service',
  'create::Kickoff',
  'read::Kickoff',
  'update::Kickoff',
]);

function filterSoporteComercialPermissions(rules) {
  if (!Array.isArray(rules)) {
    return [];
  }
  const seen = new Set();
  const next = [];
  for (const rule of rules) {
    if (!rule || typeof rule.action !== 'string' || typeof rule.subject !== 'string') {
      continue;
    }
    const key = `${rule.action}::${rule.subject}`;
    if (!SOPORTE_COMERCIAL_ALLOWED_KEYS.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push({ action: rule.action, subject: rule.subject });
  }
  return next;
}

/**
 * EjecutivoComercial: Leads like Gestor, Calificación CRU, OUV owner
 * (CRUX + read motivos), Empresas/Contactos CRU, Implementación read-only.
 */
const EJECUTIVO_COMERCIAL_ALLOWED_KEYS = new Set([
  'create::Lead',
  'read::Lead',
  'update::Lead',
  'create::Campaign',
  'read::Campaign',
  'update::Campaign',
  'create::Sql',
  'read::Sql',
  'update::Sql',
  'create::Opportunity',
  'read::Opportunity',
  'update::Opportunity',
  'close::Opportunity',
  'read::MotivoPerdida',
  'read::MotivoDescarte',
  'create::Account',
  'read::Account',
  'update::Account',
  'create::Person',
  'read::Person',
  'update::Person',
  'read::Service',
]);

function filterEjecutivoComercialPermissions(rules) {
  if (!Array.isArray(rules)) {
    return [];
  }
  const seen = new Set();
  const next = [];
  for (const rule of rules) {
    if (!rule || typeof rule.action !== 'string' || typeof rule.subject !== 'string') {
      continue;
    }
    const key = `${rule.action}::${rule.subject}`;
    if (!EJECUTIVO_COMERCIAL_ALLOWED_KEYS.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push({ action: rule.action, subject: rule.subject });
  }
  return next;
}

/**
 * PMO: Implementación only (ver SER + ampliar). No Empresas/Contactos or other modules.
 */
const PMO_ALLOWED_KEYS = new Set([
  'read::Service',
  'update::Service',
]);

function filterPmoPermissions(rules) {
  if (!Array.isArray(rules)) {
    return [];
  }
  const seen = new Set();
  const next = [];
  for (const rule of rules) {
    if (!rule || typeof rule.action !== 'string' || typeof rule.subject !== 'string') {
      continue;
    }
    const key = `${rule.action}::${rule.subject}`;
    if (!PMO_ALLOWED_KEYS.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push({ action: rule.action, subject: rule.subject });
  }
  return next;
}

/**
 * Preventa: OUV view-only (solicitudes are part of OUV detail).
 */
const PREVENTA_ALLOWED_KEYS = new Set(['read::Opportunity']);

function filterPreventaPermissions(rules) {
  if (!Array.isArray(rules)) {
    return [];
  }
  const seen = new Set();
  const next = [];
  for (const rule of rules) {
    if (!rule || typeof rule.action !== 'string' || typeof rule.subject !== 'string') {
      continue;
    }
    const key = `${rule.action}::${rule.subject}`;
    if (!PREVENTA_ALLOWED_KEYS.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push({ action: rule.action, subject: rule.subject });
  }
  return next;
}

module.exports = {
  BASE_ROLES,
  buildPermissions,
  filterDirectorMercadeoPermissions,
  filterGestorMercadeoPermissions,
  filterSoporteComercialPermissions,
  filterEjecutivoComercialPermissions,
  filterPmoPermissions,
  filterPreventaPermissions,
  normalizeRoleKey,
  MATRIX,
  SUBJECTS,
};
