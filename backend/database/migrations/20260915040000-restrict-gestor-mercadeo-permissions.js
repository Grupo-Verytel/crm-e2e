'use strict';

const { buildPermissions } = require('../seeders/lib/role-permissions');

/**
 * GestorMercadeo: Leads + campañas + dashboard. No MQL, no Calificación.
 * OUV read-only. Remaining modules stay locked.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const permissions = JSON.stringify(buildPermissions('GestorMercadeo'));
    await queryInterface.sequelize.query(
      `UPDATE roles SET permissions = :permissions
       WHERE LOWER(REPLACE(REPLACE(REPLACE(name, ' ', ''), '_', ''), '-', '')) = 'gestormercadeo'`,
      { replacements: { permissions } },
    );
  },

  async down() {
    // Non-destructive.
  },
};
