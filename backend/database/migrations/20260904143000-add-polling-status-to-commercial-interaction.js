'use strict';

/**
 * Caché del último `processing_status` acusada por MEP en
 * POST .../processing-receipts. No cruza el contrato `/v1` de intake
 * (el GET de interacciones no lo serializa).
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
        'polling_status',
      ))
    ) {
      await queryInterface.addColumn(
        'commercial_interaction',
        'polling_status',
        {
          type: Sequelize.ENUM(
            'ACCEPTED',
            'DUPLICATE',
            'QUARANTINED',
            'REJECTED',
          ),
          allowNull: true,
        },
      );
    }

    await queryInterface.sequelize.query(`
      UPDATE commercial_interaction ci
      INNER JOIN (
        SELECT pr.interaction_id, pr.processing_status
        FROM processing_receipt pr
        INNER JOIN (
          SELECT interaction_id, MAX(id) AS max_id
          FROM processing_receipt
          GROUP BY interaction_id
        ) latest ON latest.max_id = pr.id
      ) src ON src.interaction_id = ci.id
      SET ci.polling_status = src.processing_status
    `);
  },

  async down(queryInterface) {
    if (
      await columnExists(
        queryInterface,
        'commercial_interaction',
        'polling_status',
      )
    ) {
      await queryInterface.removeColumn(
        'commercial_interaction',
        'polling_status',
      );
    }
  },
};
