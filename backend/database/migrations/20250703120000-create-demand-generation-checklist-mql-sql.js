'use strict';

/**
 * Phase-2 tables for demand-generation (spec-demand-generation.md v2.0):
 * interactions, lead_checklist, mqls, sqls.
 * Also aligns leads.estado to MQL_PENDING, adds fecha_ultima_interaccion and
 * the Wave 2 scoring columns (modeled but inactive).
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Align lead estado enum with the state machine (MQL -> MQL_PENDING).
    await queryInterface.sequelize.query(`
      ALTER TABLE leads
      MODIFY COLUMN estado ENUM(
        'Nuevo',
        'TOFU',
        'MOFU',
        'MQL_PENDING',
        'SQL',
        'Reciclaje',
        'Descartado'
      ) NOT NULL DEFAULT 'Nuevo'
    `);

    await queryInterface.addColumn('leads', 'fecha_ultima_interaccion', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Wave 2 scoring columns — nullable, no calculation engine in v1.
    await queryInterface.addColumn('leads', 'lead_score', {
      type: Sequelize.SMALLINT,
      allowNull: true,
    });
    await queryInterface.addColumn('leads', 'mql_score', {
      type: Sequelize.SMALLINT,
      allowNull: true,
    });
    await queryInterface.addColumn('leads', 'sql_score', {
      type: Sequelize.SMALLINT,
      allowNull: true,
    });

    await queryInterface.createTable('interactions', {
      interaction_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
      },
      lead_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'leads', key: 'lead_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      tipo: {
        type: Sequelize.ENUM(
          'Email',
          'Llamada',
          'Reunion',
          'Webinar',
          'Descarga',
          'VisitaWeb',
        ),
        allowNull: false,
      },
      subtipo: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },
      canal: {
        type: Sequelize.ENUM(
          'Email',
          'Telefono',
          'LinkedIn',
          'Presencial',
          'Web',
          'Otro',
        ),
        allowNull: false,
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      resultado: {
        type: Sequelize.ENUM('Positivo', 'Neutro', 'Negativo', 'SinRespuesta'),
        allowNull: true,
      },
      campana_id: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'campaigns', key: 'campana_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      responsable_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'users', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      fecha: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      puntos_scoring: {
        type: Sequelize.SMALLINT,
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

    await queryInterface.addIndex('interactions', ['lead_id'], {
      name: 'idx_interactions_lead_id',
    });
    await queryInterface.addIndex('interactions', ['campana_id'], {
      name: 'idx_interactions_campana_id',
    });
    await queryInterface.addIndex('interactions', ['fecha'], {
      name: 'idx_interactions_fecha',
    });

    await queryInterface.createTable('lead_checklist', {
      checklist_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
      },
      lead_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'leads', key: 'lead_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      criterio_sector_objetivo: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      criterio_necesidad_portafolio: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      criterio_acceso_decisor: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      criterio_presupuesto_indicios: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      resultado: {
        type: Sequelize.ENUM('Calificado', 'NoCalificado'),
        allowNull: false,
        defaultValue: 'NoCalificado',
      },
      completado_por: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'users', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      fecha_completado: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('lead_checklist', ['lead_id'], {
      name: 'idx_lead_checklist_lead_id',
    });

    await queryInterface.createTable('mqls', {
      mql_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
      },
      lead_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        unique: true,
        references: { model: 'leads', key: 'lead_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      checklist_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'lead_checklist', key: 'checklist_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      calificado_por: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'users', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      fecha_calificacion: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      motivo_calificacion: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      estado: {
        type: Sequelize.ENUM(
          'Activo',
          'ConvertidoSQL',
          'Devuelto',
          'Descartado',
        ),
        allowNull: false,
        defaultValue: 'Activo',
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

    await queryInterface.addIndex('mqls', ['estado'], {
      name: 'idx_mqls_estado',
    });
    await queryInterface.addIndex('mqls', ['calificado_por'], {
      name: 'idx_mqls_calificado_por',
    });

    await queryInterface.createTable('sqls', {
      sql_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
      },
      mql_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        unique: true,
        references: { model: 'mqls', key: 'mql_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      en_backlog: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      comercial_asignado_id: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'users', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      fecha_creacion: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
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

    await queryInterface.addIndex('sqls', ['en_backlog'], {
      name: 'idx_sqls_en_backlog',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('sqls');
    await queryInterface.dropTable('mqls');
    await queryInterface.dropTable('lead_checklist');
    await queryInterface.dropTable('interactions');

    await queryInterface.removeColumn('leads', 'sql_score');
    await queryInterface.removeColumn('leads', 'mql_score');
    await queryInterface.removeColumn('leads', 'lead_score');
    await queryInterface.removeColumn('leads', 'fecha_ultima_interaccion');

    await queryInterface.sequelize.query(`
      ALTER TABLE leads
      MODIFY COLUMN estado ENUM(
        'Nuevo',
        'TOFU',
        'MOFU',
        'MQL',
        'SQL',
        'Reciclaje',
        'Descartado'
      ) NOT NULL DEFAULT 'Nuevo'
    `);
  },
};
