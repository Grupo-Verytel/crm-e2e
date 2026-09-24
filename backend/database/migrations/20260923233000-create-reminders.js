'use strict';

/**
 * Personal reminders. Optional link to an interaction. Delivery is a
 * separate row in `notifications` when remind_at is reached.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reminders', {
      reminder_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'users', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      interaction_id: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'interactions', key: 'interaction_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      event_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      remind_days_before: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      remind_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      note: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('Pendiente', 'Enviado', 'Cancelado'),
        allowNull: false,
        defaultValue: 'Pendiente',
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

    await queryInterface.addIndex('reminders', ['user_id'], {
      name: 'idx_reminders_user_id',
    });
    await queryInterface.addIndex('reminders', ['interaction_id'], {
      name: 'idx_reminders_interaction_id',
    });
    await queryInterface.addIndex('reminders', ['status', 'remind_at'], {
      name: 'idx_reminders_status_remind_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('reminders');
  },
};
