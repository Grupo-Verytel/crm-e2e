'use strict';

/**
 * Índice de lectura de `GET /v1/ouv_context/{ouv_id}`: las solicitudes de una
 * OUV se filtran por `crm_opportunity_ref` y se pagina por
 * `(source_created_at, id)` descendente.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      `
        SELECT COUNT(*) AS cnt
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'commercial_interaction'
          AND INDEX_NAME = 'ix_commercial_interaction_opportunity_ref'
      `,
    );
    if (Number(rows[0]?.cnt ?? 0) > 0) {
      return;
    }

    await queryInterface.addIndex(
      'commercial_interaction',
      ['crm_opportunity_ref', 'source_created_at', 'id'],
      { name: 'ix_commercial_interaction_opportunity_ref' },
    );
  },

  async down(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      `
        SELECT COUNT(*) AS cnt
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'commercial_interaction'
          AND INDEX_NAME = 'ix_commercial_interaction_opportunity_ref'
      `,
    );
    if (Number(rows[0]?.cnt ?? 0) === 0) {
      return;
    }

    await queryInterface.removeIndex(
      'commercial_interaction',
      'ix_commercial_interaction_opportunity_ref',
    );
  },
};
