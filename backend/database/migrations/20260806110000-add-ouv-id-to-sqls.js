'use strict';

/**
 * Adds nullable FK sqls.ouv_id → ouvs (filled on SQL→OUV conversion).
 */

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
    if (!(await columnExists(queryInterface, 'sqls', 'ouv_id'))) {
      await queryInterface.addColumn('sqls', 'ouv_id', {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'ouvs', key: 'ouv_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    if (!(await indexExists(queryInterface, 'sqls', 'idx_sqls_ouv_id'))) {
      await queryInterface.addIndex('sqls', ['ouv_id'], {
        name: 'idx_sqls_ouv_id',
        unique: true,
      });
    }
  },

  async down(queryInterface) {
    if (await indexExists(queryInterface, 'sqls', 'idx_sqls_ouv_id')) {
      await queryInterface.removeIndex('sqls', 'idx_sqls_ouv_id');
    }
    if (await columnExists(queryInterface, 'sqls', 'ouv_id')) {
      await queryInterface.removeColumn('sqls', 'ouv_id');
    }
  },
};
