'use strict';

/**
 * `create Service` habilita `POST /api/v1/implementation/projects/:ouvId`, que abre
 * el proyecto de implementación en el PMO (Control Project).
 *
 * Hasta ahora el permiso vivía sólo en el rol PMO, así que el comercial que gana la
 * OUV no podía abrir su proyecto. Se agrega a quien realmente ejecuta la acción.
 */
const RULE = { action: 'create', subject: 'Service' };

const TARGET_ROLES = ['EjecutivoComercial', 'Admin'];

function parsePermissions(value) {
  const permissions = typeof value === 'string' ? JSON.parse(value) : value;
  return Array.isArray(permissions) ? permissions : [];
}

function hasRule(permissions, rule) {
  return permissions.some(
    (p) => p.action === rule.action && p.subject === rule.subject,
  );
}

function save(queryInterface, roleId, permissions) {
  return queryInterface.sequelize.query(
    `UPDATE roles SET permissions = :permissions WHERE role_id = :roleId`,
    {
      replacements: { permissions: JSON.stringify(permissions), roleId },
    },
  );
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [roles] = await queryInterface.sequelize.query(
      `SELECT role_id, name, permissions FROM roles WHERE name IN (:names)`,
      { replacements: { names: TARGET_ROLES } },
    );

    for (const role of roles) {
      const permissions = parsePermissions(role.permissions);
      if (hasRule(permissions, RULE)) {
        continue;
      }

      permissions.push({ ...RULE });
      await save(queryInterface, role.role_id, permissions);
    }
  },

  async down(queryInterface) {
    // El rol PMO conserva el permiso: lo tenía antes de esta migración.
    const [roles] = await queryInterface.sequelize.query(
      `SELECT role_id, permissions FROM roles WHERE name IN (:names)`,
      { replacements: { names: TARGET_ROLES } },
    );

    for (const role of roles) {
      const permissions = parsePermissions(role.permissions);
      const next = permissions.filter(
        (p) => !(p.action === RULE.action && p.subject === RULE.subject),
      );

      if (next.length !== permissions.length) {
        await save(queryInterface, role.role_id, next);
      }
    }
  },
};
