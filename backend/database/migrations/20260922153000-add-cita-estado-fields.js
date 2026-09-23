'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = async (table) => {
      try {
        return await queryInterface.describeTable(table);
      } catch {
        return null;
      }
    };

    const citaColumns = await tableInfo('sql_citas');
    if (citaColumns && !citaColumns.estado) {
      await queryInterface.addColumn('sql_citas', 'estado', {
        type: Sequelize.ENUM(
          'Agendada',
          'Reagendada',
          'Realizada',
          'Cancelada',
        ),
        allowNull: false,
        defaultValue: 'Agendada',
        after: 'agendada_por',
      });
    }

    const leadColumns = await tableInfo('leads');
    if (leadColumns && !leadColumns.cita_estado) {
      await queryInterface.addColumn('leads', 'cita_estado', {
        type: Sequelize.ENUM(
          'Agendada',
          'Reagendada',
          'Realizada',
          'Cancelada',
        ),
        allowNull: true,
        after: 'fecha_cita',
      });
    }
  },

  async down(queryInterface) {
    const tableInfo = async (table) => {
      try {
        return await queryInterface.describeTable(table);
      } catch {
        return null;
      }
    };

    const citaColumns = await tableInfo('sql_citas');
    if (citaColumns?.estado) {
      await queryInterface.removeColumn('sql_citas', 'estado');
    }

    const leadColumns = await tableInfo('leads');
    if (leadColumns?.cita_estado) {
      await queryInterface.removeColumn('leads', 'cita_estado');
    }
  },
};
