'use strict';

/**
 * Bitácora de interacciones comerciales de una OUV — con hilo de respuestas.
 *
 * La pantalla `/opportunities/:ouvId` (pestaña «Interacciones») guardaba
 * cada actividad en `localStorage`, así que dos usuarios sobre la misma OUV
 * veían bitácoras distintas y nada quedaba en el CRM. Estas tablas lo mueven
 * a MySQL para que la bitácora sea compartida y auditable.
 *
 * Deliberadamente separado de `demand_generation.interactions`: aquella tabla
 * cuelga de `lead_id` con enum de tipo/canal para telemetría de campañas; ésta
 * cuelga de `ouv_id` y es texto libre por hilos para el comercial dueño.
 *
 * Convención de nombres: DR 2026-08 (tablas en inglés).
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

async function indexExists(queryInterface, table, indexName) {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT COUNT(*) AS cnt
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
        AND INDEX_NAME = :indexName
    `,
    { replacements: { table, indexName } },
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
}

const TIMESTAMPS = (Sequelize) => ({
  created_at: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
  },
  updated_at: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
  },
  deleted_at: {
    type: Sequelize.DATE,
    allowNull: true,
  },
});

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'ouv_interactions'))) {
      await queryInterface.createTable('ouv_interactions', {
        ouv_interaction_id: {
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
        titulo: { type: Sequelize.STRING(200), allowNull: false },
        observaciones: { type: Sequelize.TEXT, allowNull: true },
        // Etiquetas de sistema (p. ej. cierre como Perdida/Descartada). El
        // formulario del comercial no las envía.
        etiquetas: { type: Sequelize.JSON, allowNull: true },
        registrado_por_id: {
          type: Sequelize.CHAR(36),
          allowNull: false,
          references: { model: 'users', key: 'user_id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        registrado_por_nombre: {
          type: Sequelize.STRING(160),
          allowNull: false,
        },
        fecha_registrada: {
          type: Sequelize.DATE(3),
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP(3)'),
        },
        ...TIMESTAMPS(Sequelize),
      });
    }

    if (
      !(await indexExists(
        queryInterface,
        'ouv_interactions',
        'ouv_interactions_ouv_id',
      ))
    ) {
      await queryInterface.addIndex('ouv_interactions', ['ouv_id'], {
        name: 'ouv_interactions_ouv_id',
      });
    }

    if (!(await tableExists(queryInterface, 'ouv_interaction_replies'))) {
      await queryInterface.createTable('ouv_interaction_replies', {
        ouv_interaction_reply_id: {
          type: Sequelize.CHAR(36),
          primaryKey: true,
          allowNull: false,
        },
        ouv_interaction_id: {
          type: Sequelize.CHAR(36),
          allowNull: false,
          references: {
            model: 'ouv_interactions',
            key: 'ouv_interaction_id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        titulo: { type: Sequelize.STRING(200), allowNull: false },
        observaciones: { type: Sequelize.TEXT, allowNull: true },
        registrado_por_id: {
          type: Sequelize.CHAR(36),
          allowNull: false,
          references: { model: 'users', key: 'user_id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        registrado_por_nombre: {
          type: Sequelize.STRING(160),
          allowNull: false,
        },
        fecha_registrada: {
          type: Sequelize.DATE(3),
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP(3)'),
        },
        ...TIMESTAMPS(Sequelize),
      });
    }

    if (
      !(await indexExists(
        queryInterface,
        'ouv_interaction_replies',
        'ouv_interaction_replies_parent',
      ))
    ) {
      await queryInterface.addIndex(
        'ouv_interaction_replies',
        ['ouv_interaction_id'],
        { name: 'ouv_interaction_replies_parent' },
      );
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'ouv_interaction_replies')) {
      await queryInterface.dropTable('ouv_interaction_replies');
    }
    if (await tableExists(queryInterface, 'ouv_interactions')) {
      await queryInterface.dropTable('ouv_interactions');
    }
  },
};
