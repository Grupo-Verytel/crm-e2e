'use strict';

/**
 * Minimal ouvs table for SQL→OUV conversion (spec-calificacion EARS-12 / R2).
 * Only the fields required at creation time — no funnel/presupuesto/cierre columns.
 */

const SEGMENTOS = ['Gobierno', 'D&S', 'ProyectosEspeciales', 'B2B'];
const ZONAS = [
  'UNIVERSO',
  'ENCIMA_FUNNEL',
  'EN_FUNNEL',
  'MAYOR_PROBABILIDAD',
];
const RESULTADOS = ['EnCurso', 'Ganada', 'Perdida', 'Descartada'];

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
  async up(queryInterface, Sequelize) {
    if (await tableExists(queryInterface, 'ouvs')) {
      return;
    }

    await queryInterface.createTable('ouvs', {
      ouv_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
      },
      consecutivo: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true,
      },
      sql_id_origen: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        unique: true,
        references: { model: 'sqls', key: 'sql_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      comercial_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'users', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      titulo: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      segmento: {
        type: Sequelize.ENUM(...SEGMENTOS),
        allowNull: false,
      },
      vertical: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      zona_actual: {
        type: Sequelize.ENUM(...ZONAS),
        allowNull: false,
        defaultValue: 'UNIVERSO',
      },
      resultado: {
        type: Sequelize.ENUM(...RESULTADOS),
        allowNull: false,
        defaultValue: 'EnCurso',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal(
          'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
        ),
      },
    });

    await queryInterface.addIndex('ouvs', ['comercial_id'], {
      name: 'idx_ouvs_comercial_id',
    });
    await queryInterface.addIndex('ouvs', ['zona_actual'], {
      name: 'idx_ouvs_zona_actual',
    });
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'ouvs')) {
      await queryInterface.dropTable('ouvs');
    }
  },
};
