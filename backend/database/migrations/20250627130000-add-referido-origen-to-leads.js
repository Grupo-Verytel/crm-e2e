'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE leads
      MODIFY COLUMN origen ENUM(
        'Web',
        'Email',
        'LinkedIn',
        'Evento',
        'SECOP',
        'Aliado',
        'Otro',
        'Referido'
      ) NOT NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE leads
      MODIFY COLUMN origen ENUM(
        'Web',
        'Email',
        'LinkedIn',
        'Evento',
        'SECOP',
        'Aliado',
        'Otro'
      ) NOT NULL
    `);
  },
};
