'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('lead_contacts');
    if (table.tipo_influencia) {
      return;
    }

    await queryInterface.addColumn('lead_contacts', 'tipo_influencia', {
      type: Sequelize.ENUM('Economica', 'Tecnica', 'Fabrica'),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('lead_contacts');
    if (!table.tipo_influencia) {
      return;
    }

    await queryInterface.removeColumn('lead_contacts', 'tipo_influencia');
  },
};
