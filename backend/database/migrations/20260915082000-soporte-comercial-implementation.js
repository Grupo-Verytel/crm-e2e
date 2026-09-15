'use strict';

const {
  buildPermissions,
  filterSoporteComercialPermissions,
} = require('../seeders/lib/role-permissions');

/**
 * SoporteComercial: include Implementación (SER, Kickoff, CSAT). Ampliar
 * proyecto remains hidden in the project dashboard UI.
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
