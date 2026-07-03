'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('campaigns', {
      campana_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
      },
      nombre: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      tipo: {
        type: Sequelize.ENUM(
          'Email',
          'LinkedIn',
          'Evento',
          'WebinarPaid',
          'Outbound',
          'Aliado',
        ),
        allowNull: false,
      },
      canal: {
        type: Sequelize.STRING(60),
        allowNull: false,
      },
      objetivo: {
        type: Sequelize.ENUM(
          'Awareness',
          'LeadGen',
          'Nurturing',
          'Reactivacion',
        ),
        allowNull: false,
      },
      segmento_objetivo: {
        type: Sequelize.ENUM(
          'Gobierno',
          'D&S',
          'ProyectosEspeciales',
          'B2B',
          'Todos',
        ),
        allowNull: false,
      },
      responsable_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: {
          model: 'users',
          key: 'user_id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      fecha_inicio: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      fecha_fin: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      presupuesto: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: true,
      },
      gasto_real: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: true,
      },
      estado: {
        type: Sequelize.ENUM(
          'Borrador',
          'Activa',
          'Pausada',
          'Finalizada',
          'Cancelada',
        ),
        allowNull: false,
        defaultValue: 'Borrador',
      },
      leads_generados: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      cpl: {
        type: Sequelize.DECIMAL(14, 2),
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

    await queryInterface.addIndex('campaigns', ['responsable_id'], {
      name: 'idx_campaigns_responsable_id',
    });
    await queryInterface.addIndex('campaigns', ['estado'], {
      name: 'idx_campaigns_estado',
    });

    // Unique campaign name per calendar year among non-deleted rows (MySQL 8 expression index).
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX idx_campaigns_nombre_year
      ON campaigns (
        (IF(\`deleted_at\` IS NULL, CONCAT(\`nombre\`, '|', YEAR(\`fecha_inicio\`)), NULL))
      )
    `);

    await queryInterface.createTable('leads', {
      lead_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
      },
      tipo_lead: {
        type: Sequelize.ENUM(
          'Inbound',
          'Outbound',
          'Referido',
          'Aliado',
          'Licitacion',
        ),
        allowNull: false,
      },
      origen: {
        type: Sequelize.ENUM(
          'Web',
          'Email',
          'LinkedIn',
          'Evento',
          'SECOP',
          'Aliado',
          'Otro',
        ),
        allowNull: false,
      },
      sub_origen: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },
      campana_id: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: {
          model: 'campaigns',
          key: 'campana_id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      segmento: {
        type: Sequelize.ENUM(
          'Gobierno',
          'D&S',
          'ProyectosEspeciales',
          'B2B',
        ),
        allowNull: false,
      },
      industria: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },
      region: {
        type: Sequelize.STRING(60),
        allowNull: false,
      },
      pais: {
        type: Sequelize.CHAR(2),
        allowNull: false,
      },
      empresa_nombre: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      nit: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      contacto_nombre: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      cargo: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING(180),
        allowNull: false,
      },
      telefono: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      tipo_influencia: {
        type: Sequelize.ENUM(
          'Coach',
          'Tecnica',
          'Economica',
          'Usuaria',
          'DeFabrica',
        ),
        allowNull: true,
      },
      estado: {
        type: Sequelize.ENUM(
          'Nuevo',
          'TOFU',
          'MOFU',
          'MQL',
          'SQL',
          'Reciclaje',
          'Descartado',
        ),
        allowNull: false,
        defaultValue: 'Nuevo',
      },
      icp_score: {
        type: Sequelize.SMALLINT,
        allowNull: true,
      },
      responsable_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: {
          model: 'users',
          key: 'user_id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      motivo_descarte: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      utm_source: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      utm_medium: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      utm_campaign: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      fecha_captura: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      created_by: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: {
          model: 'users',
          key: 'user_id',
        },
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
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('leads', ['estado'], {
      name: 'idx_leads_estado',
    });
    await queryInterface.addIndex('leads', ['segmento'], {
      name: 'idx_leads_segmento',
    });
    await queryInterface.addIndex('leads', ['responsable_id'], {
      name: 'idx_leads_responsable_id',
    });
    await queryInterface.addIndex('leads', ['campana_id'], {
      name: 'idx_leads_campana_id',
    });
    await queryInterface.addIndex('leads', ['fecha_captura'], {
      name: 'idx_leads_fecha_captura',
    });
    await queryInterface.addIndex('leads', ['created_by'], {
      name: 'idx_leads_created_by',
    });
    await queryInterface.addIndex('leads', ['email'], {
      name: 'idx_leads_email',
    });

    // Unique NIT among non-deleted rows when NIT is present (MySQL 8 expression index).
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX idx_leads_nit_active
      ON leads (
        (IF(\`deleted_at\` IS NULL AND \`nit\` IS NOT NULL, \`nit\`, NULL))
      )
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DROP INDEX idx_leads_nit_active ON leads',
    );
    await queryInterface.dropTable('leads');
    await queryInterface.sequelize.query(
      'DROP INDEX idx_campaigns_nombre_year ON campaigns',
    );
    await queryInterface.dropTable('campaigns');
  },
};
