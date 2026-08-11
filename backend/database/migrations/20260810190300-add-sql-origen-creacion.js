'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('sqls', 'origen_creacion', {
      type: Sequelize.ENUM('enrutamiento_normal', 'directo_comercial'),
      allowNull: false,
      defaultValue: 'enrutamiento_normal',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('sqls', 'origen_creacion');
  },
};
