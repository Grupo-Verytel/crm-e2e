'use strict';

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

/**
 * Snapshot of default attendees for one SQL cita.
 * Not paranoid: sql_citas is hard-deleted on cancel and this child follows it
 * through ON DELETE CASCADE. Exception to the usual deleted_at rule.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'sql_cita_attendees'))) {
      await queryInterface.createTable('sql_cita_attendees', {
        sql_cita_attendee_id: {
          type: Sequelize.CHAR(36),
          primaryKey: true,
          allowNull: false,
        },
        cita_id: {
          type: Sequelize.CHAR(36),
          allowNull: false,
          references: { model: 'sql_citas', key: 'cita_id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        email: {
          type: Sequelize.STRING(180),
          allowNull: false,
        },
        name: {
          type: Sequelize.STRING(120),
          allowNull: true,
        },
        user_id: {
          type: Sequelize.CHAR(36),
          allowNull: true,
          references: { model: 'users', key: 'user_id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        source: {
          type: Sequelize.ENUM('default', 'manual'),
          allowNull: false,
        },
        sort_order: {
          type: Sequelize.INTEGER,
          allowNull: false,
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
      await queryInterface.sequelize.query(
        'ALTER TABLE sql_cita_attendees ENGINE=InnoDB',
      );
    }

    if (
      !(await indexExists(
        queryInterface,
        'sql_cita_attendees',
        'uq_sql_cita_attendees_cita_email',
      ))
    ) {
      await queryInterface.addIndex('sql_cita_attendees', ['cita_id', 'email'], {
        name: 'uq_sql_cita_attendees_cita_email',
        unique: true,
      });
    }

    if (
      !(await indexExists(
        queryInterface,
        'sql_cita_attendees',
        'idx_sql_cita_attendees_user_id',
      ))
    ) {
      await queryInterface.addIndex('sql_cita_attendees', ['user_id'], {
        name: 'idx_sql_cita_attendees_user_id',
      });
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'sql_cita_attendees')) {
      await queryInterface.dropTable('sql_cita_attendees');
    }
  },
};
