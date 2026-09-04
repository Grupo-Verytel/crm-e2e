'use strict';

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

async function indexExists(queryInterface, table, indexName) {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT COUNT(*) AS cnt
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
        AND INDEX_NAME = :indexName
    `,
    { replacements: { table, indexName } },
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'status_history'))) {
      await queryInterface.createTable('status_history', {
        history_id: {
          type: Sequelize.CHAR(36),
          primaryKey: true,
          allowNull: false,
        },
        entity_type: {
          type: Sequelize.STRING(32),
          allowNull: false,
        },
        entity_id: {
          type: Sequelize.CHAR(36),
          allowNull: false,
        },
        root_lead_id: {
          type: Sequelize.CHAR(36),
          allowNull: true,
        },
        from_estado: {
          type: Sequelize.STRING(64),
          allowNull: true,
        },
        to_estado: {
          type: Sequelize.STRING(64),
          allowNull: false,
        },
        trigger: {
          type: Sequelize.STRING(32),
          allowNull: false,
        },
        motivo: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        changed_by: {
          type: Sequelize.CHAR(36),
          allowNull: true,
        },
        changed_at: {
          type: Sequelize.DATE(3),
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP(3)'),
        },
        metadata: {
          type: Sequelize.JSON,
          allowNull: true,
        },
      });
    }

    if (
      !(await indexExists(
        queryInterface,
        'status_history',
        'idx_status_history_entity',
      ))
    ) {
      await queryInterface.addIndex(
        'status_history',
        ['entity_type', 'entity_id', 'changed_at'],
        { name: 'idx_status_history_entity' },
      );
    }

    if (
      !(await indexExists(
        queryInterface,
        'status_history',
        'idx_status_history_root_lead',
      ))
    ) {
      await queryInterface.addIndex(
        'status_history',
        ['root_lead_id', 'changed_at'],
        { name: 'idx_status_history_root_lead' },
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('status_history');
  },
};
