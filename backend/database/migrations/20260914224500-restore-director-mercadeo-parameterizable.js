'use strict';

const { buildPermissions } = require('../seeders/lib/role-permissions');

/**
 * Restore DirectorMercadeo as a parameterizable baseline (not all-on).
 * Leads / Calificación / OUV stay editable in the role UI; Implementation
 * extras remain a UI lock, not a forced full grant.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const permissions = JSON.stringify(buildPermissions('DirectorMercadeo'));
    await queryInterface.sequelize.query(
      `UPDATE roles SET permissions = :permissions WHERE name = 'DirectorMercadeo'`,
      { replacements: { permissions } },
    );
  },

  async down() {
    // Non-destructive.
  },
};
