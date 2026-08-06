'use strict';

/**
 * Creates `notifications` for the workflow engine (spec-workflow-engine v1.1 §3.1).
 *
 * MySQL note on dedup_key UNIQUE "parcial":
 * MySQL has no filtered UNIQUE (WHERE dedup_key IS NOT NULL). A UNIQUE index on a
 * nullable column allows multiple NULL values and enforces uniqueness only when
 * dedup_key is set — same runtime semantics as a partial unique in PostgreSQL.
 */

const ENTITY_TYPE_VALUES = [
  'LEAD',
  'MQL',
  'SQL',
  'CAMPANA',
  'OUV',
  'PRE',
  'PRI',
  'SER',
  'FACTURA',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
      notification_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
      },
      recipient_user_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'users', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      event_type: {
        type: Sequelize.STRING(60),
        allowNull: false,
      },
      entity_type: {
        type: Sequelize.ENUM(...ENTITY_TYPE_VALUES),
        allowNull: false,
      },
      entity_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
      },
      entity_label: {
        type: Sequelize.STRING(160),
        allowNull: false,
      },
      estado_anterior: {
        type: Sequelize.STRING(40),
        allowNull: true,
      },
      estado_nuevo: {
        type: Sequelize.STRING(40),
        allowNull: false,
      },
      titulo: {
        type: Sequelize.STRING(160),
        allowNull: false,
      },
      mensaje: {
        type: Sequelize.STRING(400),
        allowNull: false,
      },
      actor_user_id: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'users', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      dedup_key: {
        type: Sequelize.STRING(180),
        allowNull: true,
      },
      read_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('notifications', ['recipient_user_id'], {
      name: 'idx_notifications_recipient_user',
    });
    await queryInterface.addIndex('notifications', ['entity_type'], {
      name: 'idx_notifications_entity_type',
    });
    await queryInterface.addIndex('notifications', ['actor_user_id'], {
      name: 'idx_notifications_actor_user',
    });

    // UNIQUE on dedup_key (NULL-safe idempotency — see header comment)
    await queryInterface.addIndex('notifications', ['dedup_key'], {
      name: 'uq_notifications_dedup_key',
      unique: true,
    });

    // Composite for unread inbox (created_at DESC)
    await queryInterface.sequelize.query(`
      CREATE INDEX idx_notifications_recipient_read_created
      ON \`notifications\` (\`recipient_user_id\`, \`read_at\`, \`created_at\` DESC)
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX idx_notifications_recipient_read_created ON \`notifications\`
    `);
    await queryInterface.dropTable('notifications');
  },
};
