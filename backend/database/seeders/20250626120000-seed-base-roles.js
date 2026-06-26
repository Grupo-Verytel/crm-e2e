'use strict';

const crypto = require('crypto');
const { BASE_ROLES, buildPermissions } = require('./lib/role-permissions');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [existingRoles] = await queryInterface.sequelize.query(
      'SELECT name FROM roles',
    );
    const existingNames = new Set(existingRoles.map((role) => role.name));

    const roles = BASE_ROLES.filter((role) => !existingNames.has(role.name)).map(
      (role) => ({
        role_id: crypto.randomUUID(),
        name: role.name,
        description: role.description,
        permissions: JSON.stringify(buildPermissions(role.name)),
        is_system: true,
      }),
    );

    if (roles.length === 0) {
      return;
    }

    await queryInterface.bulkInsert('roles', roles);
  },

  async down(queryInterface) {
    const roleNames = BASE_ROLES.map((role) => role.name);

    await queryInterface.bulkDelete('roles', {
      name: roleNames,
    });
  },
};
