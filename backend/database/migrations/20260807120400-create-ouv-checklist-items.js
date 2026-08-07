'use strict';

/**
 * PASO 1 / migration 5 of 8 — CREATE ouv_checklist_items (spec §2.5 / v1.1 T3).
 */

const ZONAS = [
  'UNIVERSO',
  'ENCIMA_FUNNEL',
  'EN_FUNNEL',
  'MAYOR_PROBABILIDAD',
];

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
    if (await tableExists(queryInterface, 'ouv_checklist_items')) {
      return;
    }

    await queryInterface.createTable('ouv_checklist_items', {
      item_id: {
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
      zona: {
        type: Sequelize.ENUM(...ZONAS),
        allowNull: false,
      },
      codigo_item: {
        type: Sequelize.STRING(60),
        allowNull: false,
      },
      label: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      marcado: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      marcado_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      marcado_por: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'users', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex(
      'ouv_checklist_items',
      ['ouv_id', 'zona', 'codigo_item'],
      {
        name: 'uq_ouv_checklist_items_ouv_zona_codigo',
        unique: true,
      },
    );
    await queryInterface.addIndex('ouv_checklist_items', ['ouv_id', 'zona'], {
      name: 'idx_ouv_checklist_items_ouv_zona',
    });
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'ouv_checklist_items')) {
      await queryInterface.dropTable('ouv_checklist_items');
    }
  },
};
