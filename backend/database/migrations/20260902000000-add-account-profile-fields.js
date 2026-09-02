'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('accounts', 'economic_sector', {
      type: Sequelize.STRING(120),
      allowNull: true,
    });
    await queryInterface.addColumn('accounts', 'address', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('accounts', 'website', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('accounts', 'website');
    await queryInterface.removeColumn('accounts', 'address');
    await queryInterface.removeColumn('accounts', 'economic_sector');
  },
};
