'use strict';

const { randomUUID } = require('crypto');

const SEED = [
  { email: 'erobles@grupoverytel.com', sort_order: 1 },
  { email: 'jherrera@grupoverytel.com', sort_order: 2 },
  { email: 'otros@grupoverytel.com', sort_order: 3 },
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

async function columnExists(queryInterface, table, column) {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT COUNT(*) AS cnt
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
        AND COLUMN_NAME = :column
    `,
    { replacements: { table, column } },
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

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'default_meeting_attendees'))) {
      await queryInterface.createTable('default_meeting_attendees', {
        default_meeting_attendee_id: {
          type: Sequelize.CHAR(36),
          primaryKey: true,
          allowNull: false,
        },
        email: {
          type: Sequelize.STRING(180),
          allowNull: false,
        },
        name: {
          type: Sequelize.STRING(120),
          allowNull: true,
        },
        sort_order: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
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
    }

    if (
      !(await columnExists(
        queryInterface,
        'default_meeting_attendees',
        'active_marker',
      ))
    ) {
      await queryInterface.sequelize.query(`
        ALTER TABLE default_meeting_attendees
        ADD COLUMN active_marker TINYINT
        GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED
      `);
    }

    if (
      !(await indexExists(
        queryInterface,
        'default_meeting_attendees',
        'uq_default_meeting_attendees_active_email',
      ))
    ) {
      await queryInterface.addIndex(
        'default_meeting_attendees',
        ['email', 'active_marker'],
        {
          name: 'uq_default_meeting_attendees_active_email',
          unique: true,
        },
      );
    }

    for (const row of SEED) {
      const [existing] = await queryInterface.sequelize.query(
        `
          SELECT COUNT(*) AS cnt
          FROM default_meeting_attendees
          WHERE email = :email
            AND deleted_at IS NULL
        `,
        { replacements: { email: row.email } },
      );
      if (Number(existing[0]?.cnt ?? 0) > 0) {
        continue;
      }
      await queryInterface.bulkInsert('default_meeting_attendees', [
        {
          default_meeting_attendee_id: randomUUID(),
          email: row.email,
          name: null,
          sort_order: row.sort_order,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
      ]);
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'default_meeting_attendees')) {
      await queryInterface.dropTable('default_meeting_attendees');
    }
  },
};
