'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('leads');
    if (!table.name) {
      await queryInterface.addColumn('leads', 'name', {
        type: Sequelize.STRING(160),
        allowNull: true,
      });
    }
    if (!table.ciudad) {
      await queryInterface.addColumn('leads', 'ciudad', {
        type: Sequelize.STRING(80),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('leads');
    if (table.ciudad) {
      await queryInterface.removeColumn('leads', 'ciudad');
    }
    if (table.name) {
      await queryInterface.removeColumn('leads', 'name');
    }
  },
};
