'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const leads = await queryInterface.describeTable('leads');
    if (!leads.cita_lugar) {
      await queryInterface.addColumn('leads', 'cita_lugar', {
        type: Sequelize.STRING(200),
        allowNull: true,
      });
    }
    if (!leads.cita_contacto_nombre) {
      await queryInterface.addColumn('leads', 'cita_contacto_nombre', {
        type: Sequelize.STRING(120),
        allowNull: true,
      });
    }
    if (!leads.cita_contacto_email) {
      await queryInterface.addColumn('leads', 'cita_contacto_email', {
        type: Sequelize.STRING(160),
        allowNull: true,
      });
    }
    if (!leads.cita_contacto_telefono) {
      await queryInterface.addColumn('leads', 'cita_contacto_telefono', {
        type: Sequelize.STRING(40),
        allowNull: true,
      });
    }

    const citas = await queryInterface.describeTable('sql_citas');
    if (!citas.contacto_email) {
      await queryInterface.addColumn('sql_citas', 'contacto_email', {
        type: Sequelize.STRING(160),
        allowNull: true,
      });
    }
    if (!citas.contacto_telefono) {
      await queryInterface.addColumn('sql_citas', 'contacto_telefono', {
        type: Sequelize.STRING(40),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const leads = await queryInterface.describeTable('leads');
    for (const column of [
      'cita_lugar',
      'cita_contacto_nombre',
      'cita_contacto_email',
      'cita_contacto_telefono',
    ]) {
      if (leads[column]) {
        await queryInterface.removeColumn('leads', column);
      }
    }

    const citas = await queryInterface.describeTable('sql_citas');
    if (citas.contacto_email) {
      await queryInterface.removeColumn('sql_citas', 'contacto_email');
    }
    if (citas.contacto_telefono) {
      await queryInterface.removeColumn('sql_citas', 'contacto_telefono');
    }
  },
};
