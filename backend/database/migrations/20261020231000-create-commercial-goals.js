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

async function columnExists(queryInterface, table, column) {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT COUNT(*) AS cnt
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
        AND COLUMN_NAME = :column
    `,
    { replacements: { table, column } },
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
    if (!(await tableExists(queryInterface, 'commercial_goals'))) {
      await queryInterface.createTable('commercial_goals', {
        commercial_goal_id: {
          type: Sequelize.CHAR(36),
          allowNull: false,
          primaryKey: true,
        },
        user_id: {
          type: Sequelize.CHAR(36),
          allowNull: false,
          references: { model: 'users', key: 'user_id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        fiscal_year: {
          type: Sequelize.SMALLINT,
          allowNull: false,
        },
        quarter: {
          type: Sequelize.TINYINT,
          allowNull: false,
        },
        segment_id: {
          type: Sequelize.CHAR(36),
          allowNull: false,
          references: { model: 'segments', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        amount_cop: {
          type: Sequelize.DECIMAL(18, 0),
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
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        deleted_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      });
    }

    if (
      !(await columnExists(queryInterface, 'commercial_goals', 'active_marker'))
    ) {
      await queryInterface.sequelize.query(`
        ALTER TABLE commercial_goals
        ADD COLUMN active_marker TINYINT
        GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED
      `);
    }

    if (
      !(await indexExists(
        queryInterface,
        'commercial_goals',
        'uq_commercial_goals_active_natural',
      ))
    ) {
      await queryInterface.addIndex(
        'commercial_goals',
        ['user_id', 'fiscal_year', 'quarter', 'segment_id', 'active_marker'],
        { name: 'uq_commercial_goals_active_natural', unique: true },
      );
    }

    if (
      !(await indexExists(
        queryInterface,
        'commercial_goals',
        'idx_commercial_goals_fiscal_quarter',
      ))
    ) {
      await queryInterface.addIndex(
        'commercial_goals',
        ['fiscal_year', 'quarter'],
        { name: 'idx_commercial_goals_fiscal_quarter' },
      );
    }

    if (
      !(await indexExists(
        queryInterface,
        'commercial_goals',
        'idx_commercial_goals_segment',
      ))
    ) {
      await queryInterface.addIndex('commercial_goals', ['segment_id'], {
        name: 'idx_commercial_goals_segment',
      });
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'commercial_goals')) {
      await queryInterface.dropTable('commercial_goals');
    }
  },
};
