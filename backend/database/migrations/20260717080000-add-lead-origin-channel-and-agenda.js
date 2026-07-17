'use strict';

const CHANNELS = [
  'CAMPANA_DIGITAL',
  'BTL',
  'FABRICA',
  'GENERACION_DEMANDA_AGENCIA',
  'TRADUCTOR_NEGOCIO',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('leads', 'canal_origen', {
      type: Sequelize.ENUM(...CHANNELS),
      allowNull: false,
      defaultValue: 'CAMPANA_DIGITAL',
    });

    await queryInterface.changeColumn('leads', 'canal_origen', {
      type: Sequelize.ENUM(...CHANNELS),
      allowNull: false,
    });

    await queryInterface.addColumn('leads', 'cita_agendada', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('leads', 'fecha_cita', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('leads', 'comercial_asignado_id', {
      type: Sequelize.CHAR(36),
      allowNull: true,
      references: { model: 'users', key: 'user_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });

    await queryInterface.addIndex('leads', ['canal_origen'], {
      name: 'idx_leads_canal_origen',
    });
    await queryInterface.addIndex('leads', ['comercial_asignado_id'], {
      name: 'idx_leads_comercial_asignado_id',
    });
    await queryInterface.addIndex(
      'leads',
      ['canal_origen', 'estado', 'cita_agendada'],
      { name: 'idx_leads_agenda_queue' },
    );

    await queryInterface.changeColumn('mqls', 'checklist_id', {
      type: Sequelize.CHAR(36),
      allowNull: true,
      references: { model: 'lead_checklist', key: 'checklist_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });

    await queryInterface.sequelize.query(`
      UPDATE roles
      SET permissions = JSON_ARRAY_APPEND(
        permissions,
        '$',
        JSON_OBJECT('action', 'schedule', 'subject', 'Lead')
      )
      WHERE name = 'SoporteComercial'
        AND JSON_CONTAINS(
          permissions,
          JSON_OBJECT('action', 'schedule', 'subject', 'Lead')
        ) = 0
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE roles
      SET permissions = JSON_REMOVE(
        permissions,
        JSON_UNQUOTE(
          JSON_SEARCH(permissions, 'one', 'schedule', NULL, '$[*].action')
        )
      )
      WHERE name = 'SoporteComercial'
        AND JSON_SEARCH(
          permissions,
          'one',
          'schedule',
          NULL,
          '$[*].action'
        ) IS NOT NULL
    `);

    await queryInterface.changeColumn('mqls', 'checklist_id', {
      type: Sequelize.CHAR(36),
      allowNull: false,
      references: { model: 'lead_checklist', key: 'checklist_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });

    await queryInterface.removeIndex('leads', 'idx_leads_agenda_queue');
    await queryInterface.removeIndex(
      'leads',
      'idx_leads_comercial_asignado_id',
    );
    await queryInterface.removeIndex('leads', 'idx_leads_canal_origen');
    await queryInterface.removeColumn('leads', 'comercial_asignado_id');
    await queryInterface.removeColumn('leads', 'fecha_cita');
    await queryInterface.removeColumn('leads', 'cita_agendada');
    await queryInterface.removeColumn('leads', 'canal_origen');
  },
};
