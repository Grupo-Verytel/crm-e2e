'use strict';

const CRU_RULES = [
  { action: 'create', subject: 'Account' },
  { action: 'read', subject: 'Account' },
  { action: 'update', subject: 'Account' },
  { action: 'create', subject: 'Person' },
  { action: 'read', subject: 'Person' },
  { action: 'update', subject: 'Person' },
];

const DELETE_RULES = [
  { action: 'delete', subject: 'Account' },
  { action: 'delete', subject: 'Person' },
];

function hasRule(permissions, rule) {
  return permissions.some(
    (p) => p.action === rule.action && p.subject === rule.subject,
  );
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [roles] = await queryInterface.sequelize.query(
      `SELECT role_id, name, permissions FROM roles`,
    );

    for (const role of roles) {
      let permissions =
        typeof role.permissions === 'string'
          ? JSON.parse(role.permissions)
          : role.permissions;
      if (!Array.isArray(permissions)) {
        permissions = [];
      }

      const toAdd = [...CRU_RULES];
      if (role.name === 'SoporteComercial') {
        toAdd.push(...DELETE_RULES);
      }

      let changed = false;
      for (const rule of toAdd) {
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
    const removeSet = [...CRU_RULES, ...DELETE_RULES];
    const [roles] = await queryInterface.sequelize.query(
      `SELECT role_id, permissions FROM roles`,
    );

    for (const role of roles) {
      let permissions =
        typeof role.permissions === 'string'
          ? JSON.parse(role.permissions)
          : role.permissions;
      if (!Array.isArray(permissions)) {
        continue;
      }

      const next = permissions.filter(
        (p) =>
          !removeSet.some(
            (r) => r.action === p.action && r.subject === p.subject,
          ),
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
