'use strict';

const {
  buildPermissions,
  filterSoporteComercialPermissions,
} = require('../seeders/lib/role-permissions');

/**
 * SoporteComercial baseline: Leads (all), Calificación RU, OUV view + catalogs,
 * Empresas/Contactos CRUD. Remaining modules stay locked.
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
