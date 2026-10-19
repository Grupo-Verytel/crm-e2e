'use strict';

const RULE = { action: 'manage_high_value', subject: 'Account' };

function hasRule(permissions, rule) {
  return permissions.some(
    (p) => p.action === rule.action && p.subject === rule.subject,
  );
}

function parsePermissions(value) {
  const permissions = typeof value === 'string' ? JSON.parse(value) : value;
  return Array.isArray(permissions) ? permissions : [];
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [roles] = await queryInterface.sequelize.query(
      `SELECT role_id, name, permissions FROM roles WHERE name IN ('SoporteComercial', 'Admin')`,
    );

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
    const [roles] = await queryInterface.sequelize.query(
      `SELECT role_id, name, permissions FROM roles WHERE name IN ('SoporteComercial', 'Admin')`,
    );

    for (const role of roles) {
      const permissions = parsePermissions(role.permissions);
      const next = permissions.filter(
        (p) => !(p.action === RULE.action && p.subject === RULE.subject),
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
