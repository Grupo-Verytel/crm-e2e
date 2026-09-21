'use strict';

/**
 * Adds Usuario and Coach to ouv_influencias.tipo and seeds the two new
 * slots on every existing OUV (SinEvaluar, no contact).
 */

const TIPOS_NUEVOS = ['Usuario', 'Coach'];
const ENUM_NUEVO =
  "ENUM('Economica','Tecnica','Fabrica','Usuario','Coach') NOT NULL";
const ENUM_VIEJO = "ENUM('Economica','Tecnica','Fabrica') NOT NULL";

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

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    if (!(await tableExists(queryInterface, 'ouv_influencias'))) {
      return;
    }

    await queryInterface.sequelize.query(
      `ALTER TABLE ouv_influencias MODIFY COLUMN tipo ${ENUM_NUEVO}`,
    );

    for (const tipo of TIPOS_NUEVOS) {
      await queryInterface.sequelize.query(
        `
          INSERT INTO ouv_influencias (
            influencia_id,
            ouv_id,
            tipo,
            estado,
            contacto_ouv_id,
            notas,
            motivo_estado,
            fecha_ultimo_cambio,
            created_at
          )
          SELECT
            UUID(),
            o.ouv_id,
            :tipo,
            'SinEvaluar',
            NULL,
            NULL,
            NULL,
            NULL,
            NOW()
          FROM ouvs o
          WHERE NOT EXISTS (
            SELECT 1
            FROM ouv_influencias i
            WHERE i.ouv_id = o.ouv_id
              AND i.tipo = :tipo
          )
        `,
        { replacements: { tipo } },
      );
    }
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, 'ouv_influencias'))) {
      return;
    }

    await queryInterface.sequelize.query(
      `
        DELETE FROM ouv_influencias
        WHERE tipo IN ('Usuario', 'Coach')
      `,
    );

    await queryInterface.sequelize.query(
      `ALTER TABLE ouv_influencias MODIFY COLUMN tipo ${ENUM_VIEJO}`,
    );
  },
};
