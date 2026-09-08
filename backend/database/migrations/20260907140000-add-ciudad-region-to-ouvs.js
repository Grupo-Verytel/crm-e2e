'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('ouvs');
    if (!table.ciudad) {
      await queryInterface.addColumn('ouvs', 'ciudad', {
        type: Sequelize.STRING(80),
        allowNull: true,
      });
    }
    if (!table.region) {
      await queryInterface.addColumn('ouvs', 'region', {
        type: Sequelize.STRING(60),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('ouvs');
    if (table.region) {
      await queryInterface.removeColumn('ouvs', 'region');
    }
    if (table.ciudad) {
      await queryInterface.removeColumn('ouvs', 'ciudad');
    }
  },
};
