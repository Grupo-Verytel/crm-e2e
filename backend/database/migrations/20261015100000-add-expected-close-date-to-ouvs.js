'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('ouvs');
    if (!table.expected_close_date) {
      await queryInterface.addColumn('ouvs', 'expected_close_date', {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('ouvs');
    if (table.expected_close_date) {
      await queryInterface.removeColumn('ouvs', 'expected_close_date');
    }
  },
};
