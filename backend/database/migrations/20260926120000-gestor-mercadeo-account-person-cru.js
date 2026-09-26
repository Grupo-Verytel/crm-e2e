'use strict';

/**
 * GestorMercadeo can consult, create and edit companies (Account) and
 * their contacts (Person). Delete stays with SoporteComercial.
 * The seeder matrix already lists accounts: CRU; this migration applies
 * it to roles seeded before that entry existed.
 */

const ROLE_NAME = 'GestorMercadeo';
const RULES = [
  { action: 'create', subject: 'Account' },
  { action: 'read', subject: 'Account' },
  { action: 'update', subject: 'Account' },
  { action: 'create', subject: 'Person' },
  { action: 'read', subject: 'Person' },
  { action: 'update', subject: 'Person' },
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
      `SELECT role_id, permissions FROM roles WHERE name = :name`,
      { replacements: { name: ROLE_NAME } },
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
      if (!changed) {
        continue;
      }
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
      `SELECT role_id, permissions FROM roles WHERE name = :name`,
      { replacements: { name: ROLE_NAME } },
    );

    for (const role of roles) {
      const permissions = parsePermissions(role.permissions);
      const next = permissions.filter(
        (p) =>
          !RULES.some((r) => r.action === p.action && r.subject === p.subject),
      );
      if (next.length === permissions.length) {
        continue;
      }
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
  },
};
