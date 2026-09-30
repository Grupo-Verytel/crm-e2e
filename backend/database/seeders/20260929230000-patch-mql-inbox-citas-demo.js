'use strict';

/**
 * Backfill fecha_cita on existing DEMO-MQL-INBOX leads (first 4 with cita).
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const year = new Date().getFullYear();
    for (let idx = 1; idx <= 4; idx += 1) {
      const pattern = `DEMO-MQL-INBOX-${String(idx).padStart(2, '0')}%`;
      const fecha = new Date(`${year}-09-${10 + idx}T14:00:00.000Z`);
      await queryInterface.sequelize.query(
        `UPDATE leads
         SET cita_agendada = 1,
             fecha_cita = :fecha,
             updated_at = NOW()
         WHERE deleted_at IS NULL
           AND name LIKE :pattern`,
        { replacements: { pattern, fecha } },
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE leads
       SET cita_agendada = 0,
           fecha_cita = NULL,
           updated_at = NOW()
       WHERE deleted_at IS NULL
         AND name LIKE 'DEMO-MQL-INBOX-%'`,
    );
  },
};
