'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE mep_response_version
      MODIFY COLUMN response_status
        ENUM('RECEIVED','IN_PROGRESS','PARTIALLY_COMPLETED','COMPLETED') NOT NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE mep_response_version
      MODIFY COLUMN response_status
        ENUM('RECEIVED','IN_PROGRESS','COMPLETED') NOT NULL
    `);
  },
};
