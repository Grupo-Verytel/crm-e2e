'use strict';

/**
 * OUVs created from SQL before city/region were copied from the lead
 * were left empty. Backfill from the origin lead.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const ouvs = await queryInterface.describeTable('ouvs');
    const leads = await queryInterface.describeTable('leads');
    if (!ouvs.city || !ouvs.region || !leads.city || !leads.region) {
      return;
    }

    await queryInterface.sequelize.query(`
      UPDATE ouvs o
      INNER JOIN sqls s
        ON s.sql_id = o.sql_id_origen
        AND s.deleted_at IS NULL
      INNER JOIN mqls m
        ON m.mql_id = s.mql_id
        AND m.deleted_at IS NULL
      INNER JOIN leads l
        ON l.lead_id = m.lead_id
        AND l.deleted_at IS NULL
      SET
        o.city = COALESCE(NULLIF(TRIM(o.city), ''), NULLIF(TRIM(l.city), '')),
        o.region = COALESCE(NULLIF(TRIM(o.region), ''), NULLIF(TRIM(l.region), ''))
      WHERE o.sql_id_origen IS NOT NULL
        AND (
          o.city IS NULL OR TRIM(o.city) = ''
          OR o.region IS NULL OR TRIM(o.region) = ''
        )
    `);
  },

  async down() {
    // Irreversible data backfill.
  },
};
