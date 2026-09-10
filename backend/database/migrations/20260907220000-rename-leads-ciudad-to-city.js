'use strict';

/** Aligns leads.ciudad with the existing DB column `city` (English schema). */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const table = await queryInterface.describeTable('leads');
    if (table.ciudad && !table.city) {
      await queryInterface.renameColumn('leads', 'ciudad', 'city');
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('leads');
    if (table.city && !table.ciudad) {
      await queryInterface.renameColumn('leads', 'city', 'ciudad');
    }
  },
};
