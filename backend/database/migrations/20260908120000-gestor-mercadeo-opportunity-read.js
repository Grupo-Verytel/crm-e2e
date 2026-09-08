'use strict';

/**
 * GestorMercadeo had no Opportunity permission, so /opportunities and
 * /qualification APIs returned 403. Grant read so marketing can follow
 * the SQL/OUV boards (mutations stay with Ejecutivo / Soporte).
 */

const ROLE_NAME = 'GestorMercadeo';
const RULE = { action: 'read', subject: 'Opportunity' };

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
      `SELECT role_id, permissions FROM roles WHERE name = :name`,
      { replacements: { name: ROLE_NAME } },
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
