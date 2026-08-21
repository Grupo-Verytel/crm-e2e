'use strict';

const crypto = require('crypto');
const { buildPermissions } = require('../seeders/lib/role-permissions');

const NEW_ROLES = [
  {
    name: 'ProductManager',
    description: 'Product Manager — direct lead creation to MQL_PENDING',
  },
  {
    name: 'TraductorDeNegocio',
    description: 'Traductor de Negocio — read-only referred leads',
  },
];

function hasRule(permissions, rule) {
  return permissions.some(
    (p) => p.action === rule.action && p.subject === rule.subject,
  );
}

const EJECUTIVO_LEAD_CRU = [
  { action: 'create', subject: 'Lead' },
  { action: 'read', subject: 'Lead' },
  { action: 'update', subject: 'Lead' },
  { action: 'create', subject: 'Campaign' },
  { action: 'read', subject: 'Campaign' },
  { action: 'update', subject: 'Campaign' },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [existing] = await queryInterface.sequelize.query(
      'SELECT name FROM roles',
    );
    const existingNames = new Set(existing.map((r) => r.name));
    const nowRoles = NEW_ROLES.filter((r) => !existingNames.has(r.name)).map(
      (role) => ({
        role_id: crypto.randomUUID(),
        name: role.name,
        description: role.description,
        permissions: JSON.stringify(buildPermissions(role.name)),
        is_system: true,
      }),
    );
    if (nowRoles.length > 0) {
      await queryInterface.bulkInsert('roles', nowRoles);
    }

    const [roles] = await queryInterface.sequelize.query(
      `SELECT role_id, name, permissions FROM roles WHERE name = 'EjecutivoComercial'`,
    );
    for (const role of roles) {
      let permissions =
        typeof role.permissions === 'string'
          ? JSON.parse(role.permissions)
          : role.permissions;
      if (!Array.isArray(permissions)) permissions = [];
      let changed = false;
      for (const rule of EJECUTIVO_LEAD_CRU) {
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
    await queryInterface.bulkDelete('roles', {
      name: NEW_ROLES.map((r) => r.name),
    });
  },
};
