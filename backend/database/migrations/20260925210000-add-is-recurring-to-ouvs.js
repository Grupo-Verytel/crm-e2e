'use strict';

/** Proyecto recurrente o no; null = sin definir. */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ouvs', 'is_recurring', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      after: 'region',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ouvs', 'is_recurring');
  },
};
