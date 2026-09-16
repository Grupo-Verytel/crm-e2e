'use strict';

const ORIGINAL_TYPES = ['Economica', 'Tecnica', 'Fabrica'];
const EXPANDED_TYPES = [...ORIGINAL_TYPES, 'Coach', 'Usuario'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('lead_contacts', 'tipo_influencia', {
      type: Sequelize.ENUM(...EXPANDED_TYPES),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `UPDATE lead_contacts
       SET tipo_influencia = NULL
       WHERE tipo_influencia IN ('Coach', 'Usuario')`,
    );
    await queryInterface.changeColumn('lead_contacts', 'tipo_influencia', {
      type: Sequelize.ENUM(...ORIGINAL_TYPES),
      allowNull: true,
    });
  },
};
