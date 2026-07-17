'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lead_contacts', {
      contact_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        primaryKey: true,
      },
      lead_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'leads', key: 'lead_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      position: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: false,
      },
      empresa_nombre: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      nombre: {
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

    await queryInterface.addIndex('lead_contacts', ['lead_id'], {
      name: 'idx_lead_contacts_lead_id',
    });
    await queryInterface.addIndex('lead_contacts', ['email'], {
      name: 'idx_lead_contacts_email',
    });
    await queryInterface.addIndex('lead_contacts', ['lead_id', 'position'], {
      name: 'uq_lead_contacts_lead_position',
      unique: true,
    });

    await queryInterface.sequelize.query(`
      INSERT INTO lead_contacts (
        contact_id,
        lead_id,
        position,
        empresa_nombre,
        nombre,
        cargo,
        email,
        telefono,
        created_at,
        updated_at,
        deleted_at
      )
      SELECT
        UUID(),
        lead_id,
        1,
        empresa_nombre,
        contacto_nombre,
        cargo,
        email,
        telefono,
        created_at,
        updated_at,
        deleted_at
      FROM leads
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lead_contacts');
  },
};
