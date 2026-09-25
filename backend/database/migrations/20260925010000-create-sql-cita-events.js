'use strict';

const CITA_ESTADOS = [
  'Agendada',
  'Reagendada',
  'Realizada',
  'Cancelada',
  'NoAsistio',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const citaColumns = await queryInterface.describeTable('sql_citas');
    if (!citaColumns.estado) {
      await queryInterface.addColumn('sql_citas', 'estado', {
        type: Sequelize.ENUM(...CITA_ESTADOS),
        allowNull: false,
        defaultValue: 'Agendada',
        after: 'agendada_por',
      });
    }

    await queryInterface.createTable('sql_cita_events', {
      sql_cita_event_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
      },
      sql_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'sqls', key: 'sql_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      event_type: {
        type: Sequelize.ENUM(...CITA_ESTADOS),
        allowNull: false,
      },
      occurred_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      actor_user_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'users', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      payload: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal(
          'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
        ),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('sql_cita_events', ['sql_id'], {
      name: 'idx_sql_cita_events_sql_id',
    });
    await queryInterface.addIndex('sql_cita_events', ['event_type'], {
      name: 'idx_sql_cita_events_event_type',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sql_cita_events');

    const citaColumns = await queryInterface.describeTable('sql_citas');
    if (citaColumns.estado) {
      await queryInterface.removeColumn('sql_citas', 'estado');
    }
  },
};
