'use strict';

/**
 * EjecutivoComercial is the only role name. Drop the KAM alias from description.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE roles
       SET description = 'Ejecutivo Comercial — commercial executive (Opportunity owner)'
       WHERE LOWER(REPLACE(REPLACE(REPLACE(name, ' ', ''), '_', ''), '-', '')) = 'ejecutivocomercial'`,
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE roles
       SET description = 'KAM — commercial executive (Opportunity owner)'
       WHERE LOWER(REPLACE(REPLACE(REPLACE(name, ' ', ''), '_', ''), '-', '')) = 'ejecutivocomercial'`,
    );
  },
};
