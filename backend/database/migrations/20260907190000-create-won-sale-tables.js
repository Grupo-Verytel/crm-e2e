'use strict';

/**
 * Expediente de venta ganada (Cierre de Oferta), persistente.
 *
 * La pantalla `/offers/:ouvId` guardaba todo en `localStorage`: dos usuarios
 * sobre la misma OUV veían formularios distintos, y las validaciones de
 * viabilidad que aprobaba uno nunca llegaban al otro. Estas tablas lo mueven a
 * MySQL, igual que se hizo antes con el Kickoff.
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

/** Llave foránea al expediente, común a las cuatro tablas hijas. */
const PARENT_FK = (Sequelize) => ({
  type: Sequelize.CHAR(36),
  allowNull: false,
  references: { model: 'won_sales', key: 'won_sale_id' },
  onUpdate: 'CASCADE',
  onDelete: 'CASCADE',
});

const CHILD_TABLES = [
  'won_sale_validations',
  'won_sale_members',
  'won_sale_alerts',
  'won_sale_history',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'won_sales'))) {
      await queryInterface.createTable('won_sales', {
        won_sale_id: {
          type: Sequelize.CHAR(36),
          primaryKey: true,
          allowNull: false,
        },
        ouv_id: { type: Sequelize.CHAR(36), allowNull: false },
        estado_revision: {
          type: Sequelize.ENUM('Pendiente', 'EnRevision', 'Aprobada'),
          allowNull: false,
          defaultValue: 'Pendiente',
        },

        nombre_proyecto: {
          type: Sequelize.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        fecha_inicio: { type: Sequelize.DATEONLY, allowNull: true },
        fecha_fin: { type: Sequelize.DATEONLY, allowNull: true },
        valor_facturar: {
          type: Sequelize.DECIMAL(18, 2),
          allowNull: false,
          defaultValue: 0,
        },
        costo_estimado: {
          type: Sequelize.DECIMAL(18, 2),
          allowNull: false,
          defaultValue: 0,
        },
        recurrente: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        tipo_venta: {
          type: Sequelize.ENUM('Nueva', 'Renovacion', 'Ampliacion', 'Recompra'),
          allowNull: false,
          defaultValue: 'Nueva',
        },
        director_proyecto_id: { type: Sequelize.CHAR(36), allowNull: true },
        director_proyecto_nombre: {
          type: Sequelize.STRING(160),
          allowNull: true,
        },
        centro_costos: { type: Sequelize.STRING(120), allowNull: true },
        ubv: { type: Sequelize.STRING(120), allowNull: true },
        participacion: { type: Sequelize.STRING(120), allowNull: true },
        participacion_pct: {
          type: Sequelize.SMALLINT,
          allowNull: false,
          defaultValue: 0,
        },

        envio_pmo_estado: {
          type: Sequelize.ENUM(
            'NoEnviado',
            'Pendiente',
            'Enviado',
            'Rechazado',
          ),
          allowNull: false,
          defaultValue: 'NoEnviado',
        },
        envio_pmo_consecutivo: { type: Sequelize.STRING(60), allowNull: true },
        envio_pmo_ser: { type: Sequelize.STRING(60), allowNull: true },
        envio_pmo_motivo: { type: Sequelize.TEXT, allowNull: true },
        envio_pmo_enviado_en: { type: Sequelize.DATE(3), allowNull: true },

        indicadores: { type: Sequelize.JSON, allowNull: true },
        csat: { type: Sequelize.JSON, allowNull: true },

        created_by: { type: Sequelize.CHAR(36), allowNull: true },
        updated_by: { type: Sequelize.CHAR(36), allowNull: true },
        ...TIMESTAMPS(Sequelize),
      });
    }

    // MySQL admite varios NULL dentro de un índice único, así que `ouv_id` a
    // secas no impediría un segundo expediente activo tras un borrado lógico.
    // La columna generada solo tiene valor mientras la fila está viva.
    if (!(await columnExists(queryInterface, 'won_sales', 'active_ouv_id'))) {
      await queryInterface.sequelize.query(`
        ALTER TABLE won_sales
          ADD COLUMN active_ouv_id CHAR(36)
          GENERATED ALWAYS AS (IF(deleted_at IS NULL, ouv_id, NULL)) STORED
      `);
    }

    if (
      !(await indexExists(queryInterface, 'won_sales', 'won_sales_active_ouv_id'))
    ) {
      await queryInterface.addIndex('won_sales', ['active_ouv_id'], {
        name: 'won_sales_active_ouv_id',
        unique: true,
      });
    }

    if (!(await tableExists(queryInterface, 'won_sale_validations'))) {
      await queryInterface.createTable('won_sale_validations', {
        won_sale_validation_id: {
          type: Sequelize.CHAR(36),
          primaryKey: true,
          allowNull: false,
        },
        won_sale_id: PARENT_FK(Sequelize),
        tipo: {
          type: Sequelize.ENUM('Tecnica', 'Financiera'),
          allowNull: false,
        },
        estado: {
          type: Sequelize.ENUM('Pendiente', 'Aprobado', 'Rechazado'),
          allowNull: false,
          defaultValue: 'Pendiente',
        },
        observacion: { type: Sequelize.TEXT, allowNull: true },
        usuario: { type: Sequelize.STRING(160), allowNull: true },
        fecha: { type: Sequelize.DATE(3), allowNull: true },
        sharepoint_url: { type: Sequelize.TEXT, allowNull: true },
        sharepoint_nombre: { type: Sequelize.STRING(255), allowNull: true },
        ...TIMESTAMPS(Sequelize),
      });
    }

    if (!(await tableExists(queryInterface, 'won_sale_members'))) {
      await queryInterface.createTable('won_sale_members', {
        won_sale_member_id: {
          type: Sequelize.CHAR(36),
          primaryKey: true,
          allowNull: false,
        },
        won_sale_id: PARENT_FK(Sequelize),
        ref_id: { type: Sequelize.STRING(64), allowNull: false },
        nombre: { type: Sequelize.STRING(255), allowNull: false },
        participacion_pct: {
          type: Sequelize.SMALLINT,
          allowNull: false,
          defaultValue: 0,
        },
        empresa: {
          type: Sequelize.ENUM('Frisson', 'Verytel', 'UT'),
          allowNull: true,
        },
        ...TIMESTAMPS(Sequelize),
      });
    }

    if (!(await tableExists(queryInterface, 'won_sale_alerts'))) {
      await queryInterface.createTable('won_sale_alerts', {
        won_sale_alert_id: {
          type: Sequelize.CHAR(36),
          primaryKey: true,
          allowNull: false,
        },
        won_sale_id: PARENT_FK(Sequelize),
        ref_id: { type: Sequelize.STRING(64), allowNull: false },
        tipo: { type: Sequelize.STRING(120), allowNull: false },
        estado: {
          type: Sequelize.ENUM('Activa', 'Resuelta'),
          allowNull: false,
          defaultValue: 'Activa',
        },
        descripcion: { type: Sequelize.TEXT, allowNull: false },
        fecha: { type: Sequelize.DATE(3), allowNull: true },
        ...TIMESTAMPS(Sequelize),
      });
    }

    if (!(await tableExists(queryInterface, 'won_sale_history'))) {
      await queryInterface.createTable('won_sale_history', {
        won_sale_history_entry_id: {
          type: Sequelize.CHAR(36),
          primaryKey: true,
          allowNull: false,
        },
        won_sale_id: PARENT_FK(Sequelize),
        estado: { type: Sequelize.STRING(160), allowNull: false },
        fecha: { type: Sequelize.DATE(3), allowNull: false },
        origen: { type: Sequelize.STRING(120), allowNull: false },
        ...TIMESTAMPS(Sequelize),
      });
    }

    for (const table of CHILD_TABLES) {
      const name = `${table}_won_sale_id`;
      if (!(await indexExists(queryInterface, table, name))) {
        await queryInterface.addIndex(table, ['won_sale_id'], { name });
      }
    }
  },

  async down(queryInterface) {
    for (const table of [...CHILD_TABLES].reverse()) {
      if (await tableExists(queryInterface, table)) {
        await queryInterface.dropTable(table);
      }
    }
    if (await tableExists(queryInterface, 'won_sales')) {
      await queryInterface.dropTable('won_sales');
    }
  },
};
