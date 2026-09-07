'use strict';

/**
 * Kickoff persistente (Cierre de Oferta).
 *
 * Hasta ahora el kickoff vivía en `localStorage` del navegador. Al crear
 * reuniones reales de Microsoft 365 eso dejaba el `graph_event_id` fuera del
 * alcance del resto de usuarios: nadie más veía el estado ni podía cancelar o
 * reagendar el evento. Estas tablas lo mueven a MySQL.
 *
 * Tablas nuevas en inglés (DR 2026-08 convención de nombres); los valores de
 * ENUM se mantienen en español, como manda la misma decisión.
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
    if (!(await tableExists(queryInterface, 'kickoffs'))) {
      await queryInterface.createTable('kickoffs', {
        kickoff_id: {
          type: Sequelize.CHAR(36),
          primaryKey: true,
          allowNull: false,
        },
        ouv_id: {
          type: Sequelize.CHAR(36),
          allowNull: false,
        },
        name: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        starts_at: {
          type: Sequelize.DATE(3),
          allowNull: true,
        },
        ends_at: {
          type: Sequelize.DATE(3),
          allowNull: true,
        },
        time_zone: {
          type: Sequelize.STRING(64),
          allowNull: false,
          defaultValue: 'America/Bogota',
        },
        location_types: {
          type: Sequelize.JSON,
          allowNull: false,
        },
        room_email: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        room_label: {
          type: Sequelize.STRING(120),
          allowNull: true,
        },
        location_detail: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        status: {
          type: Sequelize.ENUM('Programado', 'Realizado', 'Cancelado'),
          allowNull: false,
          defaultValue: 'Programado',
        },
        scheduling_confirmed: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        teams_validated: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        held_at: {
          type: Sequelize.DATE(3),
          allowNull: true,
        },
        graph_event_id: {
          type: Sequelize.STRING(512),
          allowNull: true,
        },
        graph_organizer_upn: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        join_url: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        web_link: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        confirmed_at: {
          type: Sequelize.DATE(3),
          allowNull: true,
        },
        created_by: {
          type: Sequelize.CHAR(36),
          allowNull: true,
        },
        updated_by: {
          type: Sequelize.CHAR(36),
          allowNull: true,
        },
        ...TIMESTAMPS(Sequelize),
      });
    }

    // Un kickoff vivo por OUV. En MySQL un índice único que incluya una
    // columna NULL admite duplicados, así que `(ouv_id, deleted_at)` no
    // serviría: se usa una columna generada que vale `ouv_id` mientras la fila
    // está viva y NULL cuando está borrada. Así el soft-delete no bloquea
    // volver a agendar y, a la vez, no puede haber dos kickoffs activos.
    if (!(await columnExists(queryInterface, 'kickoffs', 'active_ouv_id'))) {
      await queryInterface.sequelize.query(
        `
          ALTER TABLE kickoffs
          ADD COLUMN active_ouv_id CHAR(36)
          GENERATED ALWAYS AS (IF(deleted_at IS NULL, ouv_id, NULL)) STORED
        `,
      );
    }

    if (
      !(await indexExists(queryInterface, 'kickoffs', 'uq_kickoffs_active_ouv'))
    ) {
      await queryInterface.addIndex('kickoffs', ['active_ouv_id'], {
        name: 'uq_kickoffs_active_ouv',
        unique: true,
      });
    }

    if (!(await tableExists(queryInterface, 'kickoff_invitees'))) {
      await queryInterface.createTable('kickoff_invitees', {
        kickoff_invitee_id: {
          type: Sequelize.CHAR(36),
          primaryKey: true,
          allowNull: false,
        },
        kickoff_id: {
          type: Sequelize.CHAR(36),
          allowNull: false,
          references: { model: 'kickoffs', key: 'kickoff_id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        email: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        display_name: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        invitee_type: {
          type: Sequelize.ENUM('Interno', 'ContactoOuv', 'Externo'),
          allowNull: false,
          defaultValue: 'Interno',
        },
        source_ref: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        ...TIMESTAMPS(Sequelize),
      });
    }

    if (
      !(await indexExists(
        queryInterface,
        'kickoff_invitees',
        'idx_kickoff_invitees_kickoff',
      ))
    ) {
      await queryInterface.addIndex('kickoff_invitees', ['kickoff_id'], {
        name: 'idx_kickoff_invitees_kickoff',
      });
    }

    if (!(await tableExists(queryInterface, 'kickoff_approvals'))) {
      await queryInterface.createTable('kickoff_approvals', {
        kickoff_approval_id: {
          type: Sequelize.CHAR(36),
          primaryKey: true,
          allowNull: false,
        },
        kickoff_id: {
          type: Sequelize.CHAR(36),
          allowNull: false,
          references: { model: 'kickoffs', key: 'kickoff_id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        code: {
          type: Sequelize.STRING(32),
          allowNull: false,
        },
        label: {
          type: Sequelize.STRING(120),
          allowNull: false,
        },
        completed: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        completed_at: {
          type: Sequelize.DATE(3),
          allowNull: true,
        },
        completed_by: {
          type: Sequelize.CHAR(36),
          allowNull: true,
        },
        ...TIMESTAMPS(Sequelize),
      });
    }

    if (
      !(await indexExists(
        queryInterface,
        'kickoff_approvals',
        'idx_kickoff_approvals_kickoff',
      ))
    ) {
      await queryInterface.addIndex('kickoff_approvals', ['kickoff_id'], {
        name: 'idx_kickoff_approvals_kickoff',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('kickoff_approvals');
    await queryInterface.dropTable('kickoff_invitees');
    await queryInterface.dropTable('kickoffs');
  },
};
