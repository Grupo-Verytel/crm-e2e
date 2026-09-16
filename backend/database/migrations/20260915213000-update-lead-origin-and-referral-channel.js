'use strict';

const OLD_ORIGINS = [
  'Web',
  'Email',
  'LinkedIn',
  'Evento',
  'SECOP',
  'Aliado',
  'Otro',
  'Referido',
];

const NEW_ORIGINS = [
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

const OLD_CHANNELS = [
  'CAMPANA_DIGITAL',
  'BTL',
  'FABRICA',
  'GENERACION_DEMANDA_AGENCIA',
  'TRADUCTOR_NEGOCIO',
  'EVENTOS',
];

const NEW_CHANNELS = [...OLD_CHANNELS, 'REFERIDO'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('leads', 'origen', {
      type: Sequelize.ENUM(...new Set([...OLD_ORIGINS, ...NEW_ORIGINS])),
      allowNull: false,
    });
    await queryInterface.changeColumn('leads', 'canal_origen', {
      type: Sequelize.ENUM(...NEW_CHANNELS),
      allowNull: false,
    });

    await queryInterface.sequelize.query(
      `UPDATE leads SET origen = 'Email marketing' WHERE origen = 'Email'`,
    );
    await queryInterface.sequelize.query(
      `UPDATE leads
       SET origen = 'Prospeccion directa', canal_origen = 'REFERIDO'
       WHERE origen = 'Referido'`,
    );

    await queryInterface.changeColumn('leads', 'origen', {
      type: Sequelize.ENUM(...NEW_ORIGINS),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('leads', 'origen', {
      type: Sequelize.ENUM(...new Set([...OLD_ORIGINS, ...NEW_ORIGINS])),
      allowNull: false,
    });

    await queryInterface.sequelize.query(
      `UPDATE leads SET origen = 'Email' WHERE origen = 'Email marketing'`,
    );
    await queryInterface.sequelize.query(
      `UPDATE leads SET origen = 'Otro' WHERE origen IN ('Instagram y Facebook', 'Prospeccion directa')`,
    );
    await queryInterface.sequelize.query(
      `UPDATE leads
       SET origen = 'Referido', canal_origen = 'CAMPANA_DIGITAL'
       WHERE canal_origen = 'REFERIDO'`,
    );

    await queryInterface.changeColumn('leads', 'origen', {
      type: Sequelize.ENUM(...OLD_ORIGINS),
      allowNull: false,
    });
    await queryInterface.changeColumn('leads', 'canal_origen', {
      type: Sequelize.ENUM(...OLD_CHANNELS),
      allowNull: false,
    });
  },
};
