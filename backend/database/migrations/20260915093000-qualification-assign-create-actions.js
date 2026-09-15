'use strict';

const {
  buildPermissions,
  filterEjecutivoComercialPermissions,
  filterSoporteComercialPermissions,
} = require('../seeders/lib/role-permissions');

/**
 * Calificación actions match the real flow: Ver / Asignar / Crear.
 * KAM: Ver + Crear OUV (no assign, no approve Lead). Soporte: Ver + Asignar.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const ejecutivo = JSON.stringify(
      filterEjecutivoComercialPermissions(
        buildPermissions('EjecutivoComercial'),
      ),
    );
    const soporte = JSON.stringify(
      filterSoporteComercialPermissions(buildPermissions('SoporteComercial')),
    );
    await queryInterface.sequelize.query(
      `UPDATE roles SET permissions = :permissions
       WHERE LOWER(REPLACE(REPLACE(REPLACE(name, ' ', ''), '_', ''), '-', '')) = 'ejecutivocomercial'`,
      { replacements: { permissions: ejecutivo } },
    );
    await queryInterface.sequelize.query(
      `UPDATE roles SET permissions = :permissions
       WHERE LOWER(REPLACE(REPLACE(REPLACE(name, ' ', ''), '_', ''), '-', '')) = 'soportecomercial'`,
      { replacements: { permissions: soporte } },
    );
  },

  async down() {
    // Non-destructive.
  },
};
