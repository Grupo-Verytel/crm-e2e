'use strict';

/**
 * PASO 1 / migration 7 of 8 — CREATE motivos_descarte.
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
    if (await tableExists(queryInterface, 'motivos_descarte')) {
      return;
    }

    await queryInterface.createTable('motivos_descarte', {
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

    await queryInterface.addIndex('motivos_descarte', ['orden'], {
      name: 'idx_motivos_descarte_orden',
    });
    await queryInterface.addIndex('motivos_descarte', ['deleted_at'], {
      name: 'idx_motivos_descarte_deleted_at',
    });
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'motivos_descarte')) {
      await queryInterface.dropTable('motivos_descarte');
    }
  },
};
