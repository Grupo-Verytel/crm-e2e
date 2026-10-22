'use strict';

const RULES = ['create', 'read', 'update', 'delete'].map((action) => ({
  action,
  subject: 'CommercialGoal',
}));

function hasRule(permissions, rule) {
  return permissions.some(
    (permission) =>
      permission.action === rule.action && permission.subject === rule.subject,
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
      let changed = false;
      for (const rule of RULES) {
        if (hasRule(permissions, rule)) {
          continue;
        }
        permissions.push(rule);
        changed = true;
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
      `SELECT role_id, name, permissions FROM roles WHERE name IN ('SoporteComercial', 'Admin')`,
    );

    for (const role of roles) {
      const permissions = parsePermissions(role.permissions);
      const next = permissions.filter(
        (permission) =>
          !RULES.some(
            (rule) =>
              permission.action === rule.action &&
              permission.subject === rule.subject,
          ),
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
