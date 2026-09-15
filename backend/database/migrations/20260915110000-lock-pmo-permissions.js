'use strict';

const {
  buildPermissions,
  filterPmoPermissions,
} = require('../seeders/lib/role-permissions');

/**
 * PMO: Implementación only (ver SER + ampliar). No Empresas/Contactos
 * or other commercial/platform modules.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const permissions = JSON.stringify(
      filterPmoPermissions(buildPermissions('PMO')),
    );
    await queryInterface.sequelize.query(
      `UPDATE roles SET permissions = :permissions
       WHERE LOWER(REPLACE(REPLACE(REPLACE(name, ' ', ''), '_', ''), '-', '')) = 'pmo'`,
      { replacements: { permissions } },
    );
  },

  async down() {
    // Non-destructive.
  },
};
