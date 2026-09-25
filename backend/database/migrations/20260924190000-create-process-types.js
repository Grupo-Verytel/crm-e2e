'use strict';

/**
 * Catalog of process types used when an OUV is closed as Ganada.
 * Placeholder names; replace the rows when the real list is ready.
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

const SEED = [
  ['7c1a0001-4e2b-41a1-8c01-000000000001', 'Valor 1', 1],
  ['7c1a0002-4e2b-41a1-8c01-000000000002', 'Valor 2', 2],
  ['7c1a0003-4e2b-41a1-8c01-000000000003', 'Valor 3', 3],
  ['7c1a0004-4e2b-41a1-8c01-000000000004', 'Valor 4', 4],
  ['7c1a0005-4e2b-41a1-8c01-000000000005', 'Valor 5', 5],
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'process_types'))) {
      await queryInterface.createTable('process_types', {
        process_type_id: {
          type: Sequelize.CHAR(36),
          primaryKey: true,
          allowNull: false,
        },
        name: {
          type: Sequelize.STRING(200),
          allowNull: false,
        },
        sort_order: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
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

      await queryInterface.addIndex('process_types', ['sort_order'], {
        name: 'idx_process_types_sort_order',
      });
      await queryInterface.addIndex('process_types', ['deleted_at'], {
        name: 'idx_process_types_deleted_at',
      });
    }

    for (const [id, name, sortOrder] of SEED) {
      await queryInterface.sequelize.query(
        `
          INSERT INTO process_types (process_type_id, name, sort_order)
          SELECT :id, :name, :sortOrder
          WHERE NOT EXISTS (
            SELECT 1 FROM process_types WHERE process_type_id = :id
          )
        `,
        { replacements: { id, name, sortOrder } },
      );
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'process_types')) {
      await queryInterface.dropTable('process_types');
    }
  },
};
