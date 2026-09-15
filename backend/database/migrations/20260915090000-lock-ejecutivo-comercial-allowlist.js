'use strict';

const {
  buildPermissions,
  filterEjecutivoComercialPermissions,
} = require('../seeders/lib/role-permissions');

/**
 * EjecutivoComercial (KAM): Leads like Gestor, Calificación + OUV per spec,
 * Implementación view-only, Empresas/Contactos CRU. Remaining modules locked.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const permissions = JSON.stringify(
      filterEjecutivoComercialPermissions(
        buildPermissions('EjecutivoComercial'),
      ),
    );
    await queryInterface.sequelize.query(
      `UPDATE roles SET permissions = :permissions
       WHERE LOWER(REPLACE(REPLACE(REPLACE(name, ' ', ''), '_', ''), '-', '')) = 'ejecutivocomercial'`,
      { replacements: { permissions } },
    );
  },

  async down() {
    // Non-destructive.
  },
};
