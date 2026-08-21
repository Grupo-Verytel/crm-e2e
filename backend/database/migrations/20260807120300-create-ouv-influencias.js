'use strict';

/**
 * PASO 1 / migration 4 of 8 — CREATE ouv_influencias (spec-ouv-funnel v1.2 §2.4).
 * contacto_ouv_id FK to ouv_contactos (nullable). No contact snapshots.
 */

const INFLUENCIA_TIPOS = ['Economica', 'Tecnica', 'Fabrica'];
const INFLUENCIA_ESTADOS = ['Verde', 'Rojo', 'Amarillo', 'SinEvaluar'];

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
    if (await tableExists(queryInterface, 'ouv_influencias')) {
      return;
    }

    await queryInterface.createTable('ouv_influencias', {
      influencia_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
      },
      ouv_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'ouvs', key: 'ouv_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      tipo: {
        type: Sequelize.ENUM(...INFLUENCIA_TIPOS),
        allowNull: false,
      },
      estado: {
        type: Sequelize.ENUM(...INFLUENCIA_ESTADOS),
        allowNull: false,
        defaultValue: 'SinEvaluar',
      },
      contacto_ouv_id: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'ouv_contactos', key: 'contacto_ouv_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      notas: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      motivo_estado: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      fecha_ultimo_cambio: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('ouv_influencias', ['ouv_id', 'tipo'], {
      name: 'uq_ouv_influencias_ouv_tipo',
      unique: true,
    });
    await queryInterface.addIndex('ouv_influencias', ['contacto_ouv_id'], {
      name: 'idx_ouv_influencias_contacto_ouv_id',
    });
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'ouv_influencias')) {
      await queryInterface.dropTable('ouv_influencias');
    }
  },
};
