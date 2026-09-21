'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const table = await queryInterface.describeTable('lead_checklist');
    if (table.criterio_presupuesto_indicios) {
      await queryInterface.removeColumn(
        'lead_checklist',
        'criterio_presupuesto_indicios',
      );
    }
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('lead_checklist');
    if (!table.criterio_presupuesto_indicios) {
      await queryInterface.addColumn(
        'lead_checklist',
        'criterio_presupuesto_indicios',
        {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
      );
    }
  },
};
