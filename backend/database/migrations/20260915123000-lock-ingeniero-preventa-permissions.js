'use strict';

const {
  buildPermissions,
  filterPreventaPermissions,
} = require('../seeders/lib/role-permissions');

/**
 * Ingeniero Preventa is the assigned job role (canonical Preventa was already locked).
 * Same allowlist: OUV view-only.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const permissions = JSON.stringify(
      filterPreventaPermissions(buildPermissions('Preventa')),
    );
    await queryInterface.sequelize.query(
      `UPDATE roles SET permissions = :permissions
       WHERE LOWER(REPLACE(REPLACE(REPLACE(name, ' ', ''), '_', ''), '-', ''))
         IN ('preventa', 'ingenieropreventa')`,
      { replacements: { permissions } },
    );
  },

  async down() {
    // Non-destructive.
  },
};
