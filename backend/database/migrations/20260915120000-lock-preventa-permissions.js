'use strict';

const {
  buildPermissions,
  filterPreventaPermissions,
} = require('../seeders/lib/role-permissions');

/**
 * Preventa: OUV view-only. No Empresas/Contactos, Pricing, Oferta or Presale CRUD.
 * Solicitudes are viewed inside the OUV detail.
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
       WHERE LOWER(REPLACE(REPLACE(REPLACE(name, ' ', ''), '_', ''), '-', '')) = 'preventa'`,
      { replacements: { permissions } },
    );
  },

  async down() {
    // Non-destructive.
  },
};
