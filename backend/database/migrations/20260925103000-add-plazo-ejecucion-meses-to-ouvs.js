'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('ouvs');
    if (!table.plazo_ejecucion_meses) {
      await queryInterface.addColumn('ouvs', 'plazo_ejecucion_meses', {
        type: Sequelize.SMALLINT.UNSIGNED,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('ouvs');
    if (table.plazo_ejecucion_meses) {
      await queryInterface.removeColumn('ouvs', 'plazo_ejecucion_meses');
    }
  },
};
