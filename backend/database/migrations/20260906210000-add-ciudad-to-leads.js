'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('leads');
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
  },
};
