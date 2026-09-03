'use strict';

/**
 * Link de documento SharePoint que el comercial adjunta al crear una
 * solicitud de preventa. Vive en la proyección CRM (UI), no en el contrato
 * `/v1` de MEP-LEAN.
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
        'sharepoint_document_url',
      ))
    ) {
      await queryInterface.addColumn(
        'commercial_interaction',
        'sharepoint_document_url',
        {
          type: Sequelize.STRING(2048),
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
        'sharepoint_document_url',
      )
    ) {
      await queryInterface.removeColumn(
        'commercial_interaction',
        'sharepoint_document_url',
      );
    }
  },
};
