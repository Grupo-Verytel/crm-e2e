'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sql_interactions', {
      sql_interaction_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
      },
      sql_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'sqls', key: 'sql_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      tipo: {
        type: Sequelize.ENUM(
          'Email',
          'Llamada',
          'Reunion',
          'Webinar',
          'Descarga',
          'Evento',
          'VisitaWeb',
        ),
        allowNull: false,
      },
      canal: {
        type: Sequelize.ENUM(
          'Email',
          'Telefono',
          'WhatsApp',
          'LinkedIn',
          'Presencial',
          'Teams',
          'GoogleMeet',
          'Web',
          'Otro',
        ),
        allowNull: false,
      },
      subtipo: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true,
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

    await queryInterface.addIndex('sql_interactions', ['sql_id'], {
      name: 'idx_sql_interactions_sql_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sql_interactions');
  },
};
