'use strict';

/**
 * PASO 1 / migration 3 of 8 — CREATE ouv_contactos (spec-ouv-funnel v1.2 §2.2).
 * No FK to lead_contacts / contactos.
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
    if (await tableExists(queryInterface, 'ouv_contactos')) {
      return;
    }

    await queryInterface.createTable('ouv_contactos', {
      contacto_ouv_id: {
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
      nombre: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      cargo: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING(180),
        allowNull: true,
      },
      telefono: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      notas: {
        type: Sequelize.TEXT,
        allowNull: true,
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

    await queryInterface.addIndex('ouv_contactos', ['ouv_id', 'deleted_at'], {
      name: 'idx_ouv_contactos_ouv_deleted',
    });
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'ouv_contactos')) {
      await queryInterface.dropTable('ouv_contactos');
    }
  },
};
