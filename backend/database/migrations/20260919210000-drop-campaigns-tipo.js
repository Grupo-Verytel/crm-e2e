'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('campaigns', 'tipo');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('campaigns', 'tipo', {
      type: Sequelize.ENUM(
        'Email',
        'LinkedIn',
        'Evento',
        'WebinarPaid',
        'Outbound',
        'Aliado',
      ),
      allowNull: false,
      defaultValue: 'Aliado',
    });
  },
};
