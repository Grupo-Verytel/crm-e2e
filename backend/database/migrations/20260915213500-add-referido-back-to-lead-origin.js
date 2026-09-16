'use strict';

const ORIGINS = [
  'Web',
  'Email marketing',
  'Instagram y Facebook',
  'Prospeccion directa',
  'LinkedIn',
  'Evento',
  'SECOP',
  'Aliado',
  'Otro',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('leads', 'origen', {
      type: Sequelize.ENUM(...ORIGINS, 'Referido'),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `UPDATE leads SET origen = 'Otro' WHERE origen = 'Referido'`,
    );
    await queryInterface.changeColumn('leads', 'origen', {
      type: Sequelize.ENUM(...ORIGINS),
      allowNull: false,
    });
  },
};
