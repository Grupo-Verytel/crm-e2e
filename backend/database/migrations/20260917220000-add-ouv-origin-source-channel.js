'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('ouvs');

    if (!table.origin) {
      await queryInterface.addColumn('ouvs', 'origin', {
        type: Sequelize.STRING(80),
        allowNull: true,
      });
    }

    if (!table.source_channel) {
      await queryInterface.addColumn('ouvs', 'source_channel', {
        type: Sequelize.STRING(80),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('ouvs');
    if (table.source_channel) {
      await queryInterface.removeColumn('ouvs', 'source_channel');
    }
    if (table.origin) {
      await queryInterface.removeColumn('ouvs', 'origin');
    }
  },
};
