'use strict';

const { buildPermissions } = require('../seeders/lib/role-permissions');

/**
 * Refresh Admin permissions to the full module catalog (CRUD + extras).
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const permissions = JSON.stringify(buildPermissions('Admin'));
    await queryInterface.sequelize.query(
      `UPDATE roles SET permissions = :permissions WHERE name = 'Admin'`,
      { replacements: { permissions } },
    );
  },

  async down() {
    // Non-destructive: leave Admin permissions as updated.
  },
};
