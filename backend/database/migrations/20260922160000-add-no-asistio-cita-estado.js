'use strict';

const CITA_ESTADO_VALUES = [
  'Agendada',
  'Reagendada',
  'Realizada',
  'Cancelada',
  'NoAsistio',
];

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
    if (citaColumns?.estado) {
      await queryInterface.changeColumn('sql_citas', 'estado', {
        type: Sequelize.ENUM(...CITA_ESTADO_VALUES),
        allowNull: false,
        defaultValue: 'Agendada',
      });
    }

    const leadColumns = await tableInfo('leads');
    if (leadColumns?.cita_estado) {
      await queryInterface.changeColumn('leads', 'cita_estado', {
        type: Sequelize.ENUM(...CITA_ESTADO_VALUES),
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const PREVIOUS = [
      'Agendada',
      'Reagendada',
      'Realizada',
      'Cancelada',
    ];

    await queryInterface.sequelize.query(
      "UPDATE sql_citas SET estado = 'Cancelada' WHERE estado = 'NoAsistio'",
    );
    await queryInterface.sequelize.query(
      "UPDATE leads SET cita_estado = 'Cancelada' WHERE cita_estado = 'NoAsistio'",
    );

    const tableInfo = async (table) => {
      try {
        return await queryInterface.describeTable(table);
      } catch {
        return null;
      }
    };

    const citaColumns = await tableInfo('sql_citas');
    if (citaColumns?.estado) {
      await queryInterface.changeColumn('sql_citas', 'estado', {
        type: Sequelize.ENUM(...PREVIOUS),
        allowNull: false,
        defaultValue: 'Agendada',
      });
    }

    const leadColumns = await tableInfo('leads');
    if (leadColumns?.cita_estado) {
      await queryInterface.changeColumn('leads', 'cita_estado', {
        type: Sequelize.ENUM(...PREVIOUS),
        allowNull: true,
      });
    }
  },
};
