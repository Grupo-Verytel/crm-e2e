'use strict';

/**
 * CREATE project_status_events — ingesta del webhook de cambio de estado del PMO
 * (Control Project). `external_event_id` es UNIQUE: es la llave de idempotencia
 * que el PMO reenvía en cada reintento.
 */

async function tableExists(queryInterface, table) {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT COUNT(*) AS cnt
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
    `,
    { replacements: { table } },
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (await tableExists(queryInterface, 'project_status_events')) {
      return;
    }

    await queryInterface.createTable('project_status_events', {
      project_status_event_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
      },
      ouv_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'ouvs', key: 'ouv_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      external_event_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
      },
      new_status: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      occurred_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      comment: {
        type: Sequelize.STRING(400),
        allowNull: true,
      },
      received_at: {
        type: Sequelize.DATE,
        allowNull: false,
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

    await queryInterface.addIndex(
      'project_status_events',
      ['external_event_id'],
      { name: 'uq_project_status_events_external_event', unique: true },
    );

    await queryInterface.addIndex(
      'project_status_events',
      ['ouv_id', 'occurred_at'],
      { name: 'idx_project_status_events_ouv_occurred' },
    );
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'project_status_events')) {
      await queryInterface.dropTable('project_status_events');
    }
  },
};
