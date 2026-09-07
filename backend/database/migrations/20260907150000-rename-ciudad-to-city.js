'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const leads = await queryInterface.describeTable('leads');
    if (leads.ciudad && !leads.city) {
      await queryInterface.renameColumn('leads', 'ciudad', 'city');
    }

    const ouvs = await queryInterface.describeTable('ouvs');
    if (ouvs.ciudad && !ouvs.city) {
      await queryInterface.renameColumn('ouvs', 'ciudad', 'city');
    }
  },

  async down(queryInterface) {
    const leads = await queryInterface.describeTable('leads');
    if (leads.city && !leads.ciudad) {
      await queryInterface.renameColumn('leads', 'city', 'ciudad');
    }

    const ouvs = await queryInterface.describeTable('ouvs');
    if (ouvs.city && !ouvs.ciudad) {
      await queryInterface.renameColumn('ouvs', 'city', 'ciudad');
    }
  },
};
