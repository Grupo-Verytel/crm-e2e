'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    let leadColumns;
    try {
      leadColumns = await queryInterface.describeTable('leads');
    } catch {
      return;
    }

    if (leadColumns.cita_estado) {
      await queryInterface.removeColumn('leads', 'cita_estado');
    }
  },

  async down() {
    // Intentionally empty: cita_estado on leads is retired. Meeting status lives on sql_citas.estado.
  },
};
