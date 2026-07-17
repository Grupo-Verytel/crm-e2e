const ACTION_MAP = {
  C: 'create',
  R: 'read',
  U: 'update',
  A: 'approve',
  X: 'close',
};

const SUBJECTS = {
  'users/roles': ['User', 'Role'],
  'leads/campaigns': ['Lead', 'Campaign'],
  opportunities: ['Opportunity'],
  presales: ['Presale'],
  pricing: ['Pricing'],
  'proposals/contracts': ['Proposal', 'Contract'],
  services: ['Service'],
  billing: ['Billing'],
  'post-sales': ['PostSale'],
  'audit-log': ['AuditLog'],
};

/** RBAC matrix §3.1 from spec-auth (keys match Role.name). */
const MATRIX = {
  Admin: {
    'users/roles': 'CRUA',
    'leads/campaigns': 'R',
    opportunities: 'R',
    presales: 'R',
    pricing: 'R',
    'proposals/contracts': 'R',
    services: 'R',
    billing: 'R',
    'post-sales': 'R',
    'audit-log': 'R',
  },
  DirectorMercadeo: {
    'leads/campaigns': 'CRUA',
    opportunities: 'R',
  },
  GestorMercadeo: {
    'leads/campaigns': 'CRU',
  },
  EjecutivoComercial: {
    'leads/campaigns': 'R',
    opportunities: 'CRUX',
    presales: 'R',
    pricing: 'R',
    'proposals/contracts': 'CRU',
    services: 'R',
    'post-sales': 'R',
  },
  SoporteComercial: {
    'leads/campaigns': 'R',
    opportunities: 'CRU',
    presales: 'R',
    pricing: 'R',
    'proposals/contracts': 'CRUA',
    services: 'R',
    billing: 'R',
    'post-sales': 'CRU',
  },
  Preventa: {
    opportunities: 'R',
    presales: 'CRUA',
    pricing: 'R',
    'proposals/contracts': 'R',
  },
  Pricing: {
    opportunities: 'R',
    presales: 'R',
    pricing: 'CRUA',
    'proposals/contracts': 'R',
  },
  PMO: {
    services: 'CRUAX',
    billing: 'R',
    'post-sales': 'R',
  },
  FyA: {
    services: 'R',
    billing: 'CRUA',
  },
  Cliente: {},
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
    description: 'KAM — commercial executive (Opportunity owner)',
  },
  {
    name: 'SoporteComercial',
    description: 'Soporte Comercial — commercial support',
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

  for (const [resource, permissionCodes] of Object.entries(roleMatrix)) {
    if (!permissionCodes) {
      continue;
    }

    const actions = parsePermissionCodes(permissionCodes);
    const subjects = SUBJECTS[resource] || [];

    for (const subject of subjects) {
      for (const action of actions) {
        rules.push({ action, subject });
      }
    }
  }

  if (roleName === 'SoporteComercial') {
    rules.push({ action: 'schedule', subject: 'Lead' });
  }

  return rules;
}

module.exports = {
  BASE_ROLES,
  buildPermissions,
};
