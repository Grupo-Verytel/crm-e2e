'use strict';

const { buildPermissions } = require('../seeders/lib/role-permissions');

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

function addMissingRules(permissions, rules) {
  const seen = new Set(
    permissions.map((rule) => `${rule.action}::${rule.subject}`),
  );
  for (const rule of rules) {
    const key = `${rule.action}::${rule.subject}`;
    if (seen.has(key)) continue;
    permissions.push(rule);
    seen.add(key);
  }
  return permissions;
}

/** DirectorMercadeo: full Leads/SQL/OUV + SER read and CSAT update. */
module.exports = {
  async up(queryInterface) {
    const directorPermissions = JSON.stringify(
      buildPermissions('DirectorMercadeo'),
    );
    await queryInterface.sequelize.query(
      `UPDATE roles SET permissions = :permissions WHERE name = 'DirectorMercadeo'`,
      { replacements: { permissions: directorPermissions } },
    );

    const csatRule = { action: 'update', subject: 'Csat' };
    const [roles] = await queryInterface.sequelize.query(
      `SELECT role_id, name, permissions FROM roles
       WHERE name IN ('Admin', 'SoporteComercial')`,
    );

    for (const role of roles) {
      const permissions = addMissingRules(
        parsePermissions(role.permissions),
        [csatRule],
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

  async down() {
    // Non-destructive: leave role permissions as updated.
  },
};
