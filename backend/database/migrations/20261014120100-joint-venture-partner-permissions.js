'use strict';

/**
 * Reglas CASL de los subjects `JointVenture` y `Partner` (DR 2026-10 UT y
 * aliados).
 *
 * Crear: solo SoporteComercial (y Admin, que conserva todo).
 * Leer: todo rol que ya lee `WonSale`, porque el catálogo se ve en la misma
 * pantalla del expediente. Se calcula sobre los permisos actuales para
 * alcanzar también a roles creados desde la UI (Planeación Comercial).
 */

const SUBJECTS = ['JointVenture', 'Partner'];
const CREATORS = ['SoporteComercial', 'Admin'];

function parsePermissions(raw) {
  const permissions = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return Array.isArray(permissions) ? permissions : [];
}

function leeWonSale(permissions) {
  return permissions.some(
    (p) =>
      (p.subject === 'WonSale' || p.subject === 'all') &&
      (p.action === 'read' || p.action === 'manage'),
  );
}

function hasRule(permissions, action, subject) {
  return permissions.some((p) => p.action === action && p.subject === subject);
}

async function writePermissions(queryInterface, roleId, permissions) {
  await queryInterface.sequelize.query(
    `UPDATE roles SET permissions = :permissions WHERE role_id = :roleId`,
    {
      replacements: {
        permissions: JSON.stringify(permissions),
        roleId,
      },
    },
  );
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [roles] = await queryInterface.sequelize.query(
      `SELECT role_id, name, permissions FROM roles`,
    );

    for (const role of roles) {
      const permissions = parsePermissions(role.permissions);
      const actions = [];
      if (leeWonSale(permissions)) actions.push('read');
      if (CREATORS.includes(role.name)) actions.push('read', 'create');

      let changed = false;
      for (const subject of SUBJECTS) {
        for (const action of new Set(actions)) {
          if (!hasRule(permissions, action, subject)) {
            permissions.push({ action, subject });
            changed = true;
          }
        }
      }

      if (changed) {
        await writePermissions(queryInterface, role.role_id, permissions);
      }
    }
  },

  async down(queryInterface) {
    const [roles] = await queryInterface.sequelize.query(
      `SELECT role_id, permissions FROM roles`,
    );

    for (const role of roles) {
      const permissions = parsePermissions(role.permissions);
      const filtered = permissions.filter((p) => !SUBJECTS.includes(p.subject));
      if (filtered.length !== permissions.length) {
        await writePermissions(queryInterface, role.role_id, filtered);
      }
    }
  },
};
