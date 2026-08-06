'use strict';

/**
 * Qualification (Módulo 2) domain prep for workflow engine consumers:
 * - sqls.estado enum + fecha_asignacion (idempotent if already present)
 * - sql_citas table (1:1 with sqls)
 * Backfills existing rows from en_backlog / comercial_asignado_id.
 */

const SQL_ESTADOS = [
  'PendienteAsignacion',
  'Asignado',
  'EnGestion',
  'ConvertidoOUV',
  'Backlog',
  'Descartado',
];

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

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const hasEstado = await columnExists(queryInterface, 'sqls', 'estado');
    if (!hasEstado) {
      await queryInterface.addColumn('sqls', 'estado', {
        type: Sequelize.ENUM(...SQL_ESTADOS),
        allowNull: true,
      });
    }

    const hasFechaAsignacion = await columnExists(
      queryInterface,
      'sqls',
      'fecha_asignacion',
    );
    if (!hasFechaAsignacion) {
      await queryInterface.addColumn('sqls', 'fecha_asignacion', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE sqls
      SET estado = 'Asignado',
          fecha_asignacion = COALESCE(fecha_asignacion, updated_at, created_at, NOW())
      WHERE comercial_asignado_id IS NOT NULL
        AND (estado IS NULL OR estado = 'PendienteAsignacion')
    `);

    await queryInterface.sequelize.query(`
      UPDATE sqls
      SET estado = 'PendienteAsignacion'
      WHERE estado IS NULL
    `);

    await queryInterface.changeColumn('sqls', 'estado', {
      type: Sequelize.ENUM(...SQL_ESTADOS),
      allowNull: false,
      defaultValue: 'PendienteAsignacion',
    });

    if (!(await indexExists(queryInterface, 'sqls', 'idx_sqls_estado'))) {
      await queryInterface.addIndex('sqls', ['estado'], {
        name: 'idx_sqls_estado',
      });
    }

    if (!(await tableExists(queryInterface, 'sql_citas'))) {
      await queryInterface.createTable('sql_citas', {
        cita_id: {
          type: Sequelize.CHAR(36),
          primaryKey: true,
          allowNull: false,
        },
        sql_id: {
          type: Sequelize.CHAR(36),
          allowNull: false,
          unique: true,
          references: { model: 'sqls', key: 'sql_id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        lugar: {
          type: Sequelize.STRING(200),
          allowNull: false,
        },
        fecha: {
          type: Sequelize.DATEONLY,
          allowNull: false,
        },
        hora: {
          type: Sequelize.TIME,
          allowNull: false,
        },
        contacto_nombre: {
          type: Sequelize.STRING(120),
          allowNull: false,
        },
        contacto_cargo: {
          type: Sequelize.STRING(100),
          allowNull: true,
        },
        descripcion: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        agendada_por: {
          type: Sequelize.CHAR(36),
          allowNull: false,
          references: { model: 'users', key: 'user_id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
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
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'sql_citas')) {
      await queryInterface.dropTable('sql_citas');
    }
    if (await indexExists(queryInterface, 'sqls', 'idx_sqls_estado')) {
      await queryInterface.removeIndex('sqls', 'idx_sqls_estado');
    }
    if (await columnExists(queryInterface, 'sqls', 'fecha_asignacion')) {
      await queryInterface.removeColumn('sqls', 'fecha_asignacion');
    }
    if (await columnExists(queryInterface, 'sqls', 'estado')) {
      await queryInterface.removeColumn('sqls', 'estado');
    }
  },
};
