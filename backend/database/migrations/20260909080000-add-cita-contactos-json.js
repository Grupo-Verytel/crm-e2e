'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const leads = await queryInterface.describeTable('leads');
    if (!leads.cita_contactos) {
      await queryInterface.addColumn('leads', 'cita_contactos', {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE leads
      SET cita_contactos = JSON_ARRAY(
        JSON_OBJECT(
          'nombre', cita_contacto_nombre,
          'email', IFNULL(cita_contacto_email, ''),
          'telefono', IFNULL(cita_contacto_telefono, '')
        )
      )
      WHERE cita_contacto_nombre IS NOT NULL
        AND cita_contactos IS NULL
    `);

    const citas = await queryInterface.describeTable('sql_citas');
    if (!citas.contactos) {
      await queryInterface.addColumn('sql_citas', 'contactos', {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE sql_citas
      SET contactos = JSON_ARRAY(
        JSON_OBJECT(
          'nombre', contacto_nombre,
          'email', IFNULL(contacto_email, ''),
          'telefono', IFNULL(contacto_telefono, '')
        )
      )
      WHERE contactos IS NULL
    `);
  },

  async down(queryInterface) {
    const leads = await queryInterface.describeTable('leads');
    if (leads.cita_contactos) {
      await queryInterface.removeColumn('leads', 'cita_contactos');
    }

    const citas = await queryInterface.describeTable('sql_citas');
    if (citas.contactos) {
      await queryInterface.removeColumn('sql_citas', 'contactos');
    }
  },
};
