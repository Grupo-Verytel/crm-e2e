'use strict';

const {
  GERENTE_COMERCIAL_ROLE_NAME,
} = require('../../src/modules/auth/constants/commercial-role-names');

const RULE = { action: 'manage_high_value', subject: 'Account' };

function hasRule(permissions, rule) {
  return permissions.some(
    (entry) => entry.action === rule.action && entry.subject === rule.subject,
  );
}

function parsePermissions(value) {
  const permissions = typeof value === 'string' ? JSON.parse(value) : value;
  return Array.isArray(permissions) ? permissions : [];
}

async function loadRole(queryInterface) {
  const [roles] = await queryInterface.sequelize.query(
    `SELECT role_id, permissions FROM roles WHERE name = :name`,
    { replacements: { name: GERENTE_COMERCIAL_ROLE_NAME } },
  );
  return roles;
}

function warnMissing() {
  console.warn(
    `[migration] roles row "${GERENTE_COMERCIAL_ROLE_NAME}" was not found. Skipped manage_high_value.`,
  );
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const roles = await loadRole(queryInterface);
    if (roles.length === 0) {
      warnMissing();
      return;
    }

    for (const role of roles) {
      const permissions = parsePermissions(role.permissions);
      if (hasRule(permissions, RULE)) {
        continue;
      }

      permissions.push(RULE);
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
    const roles = await loadRole(queryInterface);
    if (roles.length === 0) {
      warnMissing();
      return;
    }

    for (const role of roles) {
      const permissions = parsePermissions(role.permissions);
      const next = permissions.filter(
        (entry) =>
          !(entry.action === RULE.action && entry.subject === RULE.subject),
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
