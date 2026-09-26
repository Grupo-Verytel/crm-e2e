'use strict';

/**
 * SoporteComercial y Planeación Comercial editan la viabilidad del expediente
 * de cierre. SoporteComercial perdió las reglas de `20260907190100` al
 * reescribirse sus permisos; Planeación Comercial se creó desde la UI.
 */

const ROLE_IDS = [
  '4e539af2-2a6e-45a0-96a6-439c43327696', // SoporteComercial
  '7c76b48c-dca1-4879-a53f-6b444b7ed741', // Planeación Comercial
];
const ROLE_NAMES = ['SoporteComercial', 'Planeación Comercial'];
const RULES = [
  { action: 'read', subject: 'WonSale' },
  { action: 'update', subject: 'WonSale' },
];

function parsePermissions(raw) {
  const permissions = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return Array.isArray(permissions) ? permissions : [];
}

function hasRule(permissions, rule) {
  return permissions.some(
    (p) => p.action === rule.action && p.subject === rule.subject,
  );
}

async function updateRoles(queryInterface, transform) {
  const [roles] = await queryInterface.sequelize.query(
    `SELECT role_id, permissions FROM roles
     WHERE role_id IN (:roleIds) OR name IN (:roleNames)`,
    { replacements: { roleIds: ROLE_IDS, roleNames: ROLE_NAMES } },
  );

  for (const role of roles) {
    const current = parsePermissions(role.permissions);
    const next = transform(current);
    if (next.length === current.length) continue;
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

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await updateRoles(queryInterface, (permissions) => [
      ...permissions,
      ...RULES.filter((rule) => !hasRule(permissions, rule)),
    ]);
  },

  async down(queryInterface) {
    await updateRoles(queryInterface, (permissions) =>
      permissions.filter((p) => !hasRule(RULES, p)),
    );
  },
};
