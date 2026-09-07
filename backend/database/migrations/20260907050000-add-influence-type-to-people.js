'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('people');
    if (table.influence_type) {
      return;
    }

    await queryInterface.addColumn('people', 'influence_type', {
      type: Sequelize.ENUM('Economica', 'Tecnica', 'Fabrica'),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('people');
    if (!table.influence_type) {
      return;
    }

    await queryInterface.removeColumn('people', 'influence_type');
  },
};
