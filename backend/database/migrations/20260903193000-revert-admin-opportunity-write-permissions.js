'use strict';

/**
 * Revierte el alta de create/update/close de Opportunity para Admin.
 * Queda solo lectura, como en la matriz spec-auth §3.1.
 */

const RULES = [
  { action: 'create', subject: 'Opportunity' },
  { action: 'update', subject: 'Opportunity' },
  { action: 'close', subject: 'Opportunity' },
];

function parsePermissions(raw) {
  const permissions = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return Array.isArray(permissions) ? permissions : [];
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
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

  async down() {
    // No se re-aplica el privilegio de escritura de Admin.
  },
};
