'use strict';

const {
  buildPermissions,
  filterDirectorMercadeoPermissions,
} = require('../seeders/lib/role-permissions');

/**
 * DirectorMercadeo may view OUV catalogs (motivos pérdida/descarte and
 * zona checklist) as read-only. Still cannot create/update/delete them.
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
