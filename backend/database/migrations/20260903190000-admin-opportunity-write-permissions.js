'use strict';

/**
 * Admin tenía solo `read` en Opportunity (matriz draft de spec-auth).
 * En operación necesita crear/editar/cerrar OUVs aunque no sea el comercial dueño.
 */

const RULES = [
  { action: 'create', subject: 'Opportunity' },
  { action: 'update', subject: 'Opportunity' },
  { action: 'close', subject: 'Opportunity' },
];

function hasRule(permissions, rule) {
  return permissions.some(
    (p) => p.action === rule.action && p.subject === rule.subject,
  );
}

function parsePermissions(raw) {
  const permissions = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return Array.isArray(permissions) ? permissions : [];
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [roles] = await queryInterface.sequelize.query(
      `SELECT role_id, name, permissions FROM roles WHERE name = 'Admin'`,
    );

    for (const role of roles) {
      const permissions = parsePermissions(role.permissions);
      let changed = false;
      for (const rule of RULES) {
        if (!hasRule(permissions, rule)) {
          permissions.push(rule);
          changed = true;
        }
      }
      if (changed) {
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
    }
  },

  async down(queryInterface) {
    const [roles] = await queryInterface.sequelize.query(
      `SELECT role_id, permissions FROM roles WHERE name = 'Admin'`,
    );

    for (const role of roles) {
      const permissions = parsePermissions(role.permissions);
      const next = permissions.filter(
        (p) =>
          !RULES.some((r) => r.action === p.action && r.subject === p.subject),
      );
      if (next.length !== permissions.length) {
        await queryInterface.sequelize.query(
          `UPDATE roles SET permissions = :permissions WHERE role_id = :roleId`,
          {
            replacements: {
              permissions: JSON.stringify(next),
              roleId: role.role_id,
            },
          },
        );
      }
    }
  },
};
