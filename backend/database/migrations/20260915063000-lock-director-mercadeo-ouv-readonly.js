'use strict';

const {
  buildPermissions,
  filterDirectorMercadeoPermissions,
} = require('../seeders/lib/role-permissions');

/**
 * DirectorMercadeo: OUV is follow-up view only (spec-auth R, spec-ouv-funnel
 * "Otros" have no OUV actions). Strip create/update/close and catalogs.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const permissions = JSON.stringify(
      filterDirectorMercadeoPermissions(buildPermissions('DirectorMercadeo')),
    );
    await queryInterface.sequelize.query(
      `UPDATE roles SET permissions = :permissions
       WHERE LOWER(REPLACE(REPLACE(REPLACE(name, ' ', ''), '_', ''), '-', '')) = 'directormercadeo'`,
      { replacements: { permissions } },
    );
  },

  async down() {
    // Non-destructive.
  },
};
