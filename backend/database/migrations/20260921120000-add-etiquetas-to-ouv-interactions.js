'use strict';

/**
 * Backfill column `etiquetas` on `ouv_interactions`.
 *
 * The create migration (20260914120000) is idempotent: if the table already
 * existed it skipped creation, so environments that ran an earlier version of
 * that migration never received this JSON column. The Sequelize model and
 * `registrarCierre` depend on it.
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

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await columnExists(queryInterface, 'ouv_interactions', 'etiquetas'))) {
      await queryInterface.addColumn('ouv_interactions', 'etiquetas', {
        type: Sequelize.JSON,
        allowNull: true,
        after: 'observaciones',
      });
    }
  },

  async down(queryInterface) {
    if (await columnExists(queryInterface, 'ouv_interactions', 'etiquetas')) {
      await queryInterface.removeColumn('ouv_interactions', 'etiquetas');
    }
  },
};
