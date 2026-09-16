'use strict';

const ORIGINAL_TYPES = [
  'Email',
  'Llamada',
  'Reunion',
  'Webinar',
  'Descarga',
  'VisitaWeb',
];
const EXPANDED_TYPES = [...ORIGINAL_TYPES, 'Evento'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('interactions', 'tipo', {
      type: Sequelize.ENUM(...EXPANDED_TYPES),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `UPDATE interactions SET tipo = 'Reunion' WHERE tipo = 'Evento'`,
    );
    await queryInterface.changeColumn('interactions', 'tipo', {
      type: Sequelize.ENUM(...ORIGINAL_TYPES),
      allowNull: false,
    });
  },
};
