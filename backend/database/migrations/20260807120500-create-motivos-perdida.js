'use strict';

/**
 * PASO 1 / migration 6 of 8 — CREATE motivos_perdida.
 * Soft-delete via deleted_at (B1). No `activo` column in Wave 1.
 */

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
    if (await tableExists(queryInterface, 'motivos_perdida')) {
      return;
    }

    await queryInterface.createTable('motivos_perdida', {
      motivo_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
      },
      nombre: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      requiere_detalle: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      orden: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('motivos_perdida', ['orden'], {
      name: 'idx_motivos_perdida_orden',
    });
    await queryInterface.addIndex('motivos_perdida', ['deleted_at'], {
      name: 'idx_motivos_perdida_deleted_at',
    });
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'motivos_perdida')) {
      await queryInterface.dropTable('motivos_perdida');
    }
  },
};
