'use strict';

/**
 * Closure date/time for a Preventa solicitud — authority CRM (form), read by MEP intake.
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
    if (
      !(await columnExists(
        queryInterface,
        'commercial_interaction',
        'interaction_closed_at',
      ))
    ) {
      await queryInterface.addColumn(
        'commercial_interaction',
        'interaction_closed_at',
        {
          type: Sequelize.DATE(3),
          allowNull: true,
        },
      );
    }
  },

  async down(queryInterface) {
    if (
      await columnExists(
        queryInterface,
        'commercial_interaction',
        'interaction_closed_at',
      )
    ) {
      await queryInterface.removeColumn(
        'commercial_interaction',
        'interaction_closed_at',
      );
    }
  },
};
