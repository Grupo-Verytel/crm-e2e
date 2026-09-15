'use strict';

const { buildPermissions } = require('../seeders/lib/role-permissions');

/**
 * SoporteComercial: Leads (all catalog options — no CASL matrix in
 * spec-demand-generation), Calificación read+update (spec-calificacion §4),
 * OUV view + catalog CRUD (spec-ouv-funnel §4). Other seeded modules stay.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const permissions = JSON.stringify(buildPermissions('SoporteComercial'));
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
