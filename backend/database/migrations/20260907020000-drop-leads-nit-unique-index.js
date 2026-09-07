'use strict';

/**
 * Multiple leads may share the same company NIT (accounts.tax_id).
 * Uniqueness of tax_id belongs on accounts, not on leads.nit (legacy denormalized copy).
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(`
      SELECT INDEX_NAME
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'leads'
        AND INDEX_NAME = 'idx_leads_nit_active'
      LIMIT 1
    `);
    if (rows.length > 0) {
      await queryInterface.sequelize.query(
        'DROP INDEX idx_leads_nit_active ON leads',
      );
    }
  },

  async down(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(`
      SELECT INDEX_NAME
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'leads'
        AND INDEX_NAME = 'idx_leads_nit_active'
      LIMIT 1
    `);
    if (rows.length === 0) {
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX idx_leads_nit_active
        ON leads
        ((IF(\`deleted_at\` IS NULL AND \`nit\` IS NOT NULL, \`nit\`, NULL)))
      `);
    }
  },
};
