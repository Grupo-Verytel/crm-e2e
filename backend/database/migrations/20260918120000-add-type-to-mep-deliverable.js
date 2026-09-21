'use strict';

/**
 * R2 §6.4 — `Deliverable.type` opcional para desambiguar el entregable
 * cuando el `service` de contexto no basta (por ejemplo
 * `TECHNICAL_DELIVERABLE`, `FINANCIAL_DELIVERABLE`). El CRM no impone
 * taxonomía terminológica; el campo es libre y nullable.
 */

module.exports = {
  async up(queryInterface) {
    const sql = queryInterface.sequelize;

    await sql.query(`
      ALTER TABLE mep_deliverable
        ADD COLUMN type VARCHAR(64) NULL AFTER url
    `);
  },

  async down(queryInterface) {
    const sql = queryInterface.sequelize;

    await sql.query(`
      ALTER TABLE mep_deliverable
        DROP COLUMN type
    `);
  },
};
