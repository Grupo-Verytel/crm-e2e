'use strict';

const CHANNELS = [
  'CAMPANA_DIGITAL',
  'BTL',
  'FABRICA',
  'GENERACION_DEMANDA_AGENCIA',
  'TRADUCTOR_NEGOCIO',
  'EVENTOS',
];

const CHANNELS_DOWN = [
  'CAMPANA_DIGITAL',
  'BTL',
  'FABRICA',
  'GENERACION_DEMANDA_AGENCIA',
  'TRADUCTOR_NEGOCIO',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('leads', 'canal_origen', {
      type: Sequelize.ENUM(...CHANNELS),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkUpdate(
      'leads',
      { canal_origen: 'CAMPANA_DIGITAL' },
      { canal_origen: 'EVENTOS' },
    );

    await queryInterface.changeColumn('leads', 'canal_origen', {
      type: Sequelize.ENUM(...CHANNELS_DOWN),
      allowNull: false,
    });
  },
};
