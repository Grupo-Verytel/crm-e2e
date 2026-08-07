'use strict';

/**
 * PASO 1 / migration 8 of 8 — CREATE zona_checklist_templates.
 * Soft-delete via deleted_at (B1). UNIQUE (zona, codigo_item) among active rows
 * is enforced at app level when needed; DB unique includes soft-deleted rows.
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
    if (await tableExists(queryInterface, 'zona_checklist_templates')) {
      return;
    }

    await queryInterface.createTable('zona_checklist_templates', {
      template_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
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

    await queryInterface.addIndex(
      'zona_checklist_templates',
      ['zona', 'codigo_item'],
      {
        name: 'uq_zona_checklist_templates_zona_codigo',
        unique: true,
      },
    );
    await queryInterface.addIndex('zona_checklist_templates', ['zona', 'orden'], {
      name: 'idx_zona_checklist_templates_zona_orden',
    });
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'zona_checklist_templates')) {
      await queryInterface.dropTable('zona_checklist_templates');
    }
  },
};
