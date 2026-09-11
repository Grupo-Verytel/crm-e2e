'use strict';

const SQL_ROLES = {
  Admin: ['create', 'read', 'update'],
  EjecutivoComercial: ['create', 'read', 'update'],
  SoporteComercial: ['create', 'read', 'update'],
};

function parsePermissions(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Split Calificación (Sql) from Oportunidades (Opportunity). */
module.exports = {
  async up(queryInterface) {
    const [roles] = await queryInterface.sequelize.query(
      `SELECT role_id, name, permissions FROM roles
       WHERE name IN ('Admin', 'EjecutivoComercial', 'SoporteComercial')`,
    );

    for (const role of roles) {
      const actions = SQL_ROLES[role.name];
      if (!actions) continue;

      const permissions = parsePermissions(role.permissions);
      const seen = new Set(
        permissions.map((rule) => `${rule.action}::${rule.subject}`),
      );
      let changed = false;
      for (const action of actions) {
        const key = `${action}::Sql`;
        if (seen.has(key)) continue;
        permissions.push({ action, subject: 'Sql' });
        seen.add(key);
        changed = true;
      }
      if (!changed) continue;

      await queryInterface.sequelize.query(
        `UPDATE roles SET permissions = :permissions WHERE role_id = :roleId`,
        {
          replacements: {
            permissions: JSON.stringify(permissions),
            roleId: role.role_id,
          },
        },
      );
    }
  },

  async down(queryInterface) {
    const [roles] = await queryInterface.sequelize.query(
      `SELECT role_id, permissions FROM roles
       WHERE name IN ('Admin', 'EjecutivoComercial', 'SoporteComercial')`,
    );

    for (const role of roles) {
      const permissions = parsePermissions(role.permissions).filter(
        (rule) => rule.subject !== 'Sql',
      );
      await queryInterface.sequelize.query(
        `UPDATE roles SET permissions = :permissions WHERE role_id = :roleId`,
        {
          replacements: {
            permissions: JSON.stringify(permissions),
            roleId: role.role_id,
          },
        },
      );
    }
  },
};
