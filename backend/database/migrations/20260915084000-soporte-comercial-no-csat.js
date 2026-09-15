'use strict';

const {
  buildPermissions,
  filterSoporteComercialPermissions,
} = require('../seeders/lib/role-permissions');

/**
 * SoporteComercial must not edit weekly CSAT (HU-F08 is Mercadeo).
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const permissions = JSON.stringify(
      filterSoporteComercialPermissions(buildPermissions('SoporteComercial')),
    );
    await queryInterface.sequelize.query(
      `UPDATE roles SET permissions = :permissions
       WHERE LOWER(REPLACE(REPLACE(REPLACE(name, ' ', ''), '_', ''), '-', '')) = 'soportecomercial'`,
      { replacements: { permissions } },
    );
  },

  async down() {
    // Non-destructive.
  },
};
