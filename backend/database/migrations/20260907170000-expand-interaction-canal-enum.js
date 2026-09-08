'use strict';

/** Expand interactions.canal ENUM for tipo↔canal alignment. */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE interactions
      MODIFY COLUMN canal ENUM(
        'Email',
        'Telefono',
        'WhatsApp',
        'LinkedIn',
        'Presencial',
        'Teams',
        'GoogleMeet',
        'Zoom',
        'Web',
        'Otro'
      ) NOT NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE interactions
      SET canal = 'Otro'
      WHERE canal IN ('WhatsApp', 'Teams', 'GoogleMeet', 'Zoom')
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE interactions
      MODIFY COLUMN canal ENUM(
        'Email',
        'Telefono',
        'LinkedIn',
        'Presencial',
        'Web',
        'Otro'
      ) NOT NULL
    `);
  },
};
