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
  'Email Marketing',
  'Instagram & Facebook',
  'Prospeccion directa',
  'LinkedIn',
  'Evento',
  'SECOP',
  'Aliado',
  'Otro',
  'Referido',
];

function enumSql(values) {
  return values.map((value) => `'${value.replace(/'/g, "''")}'`).join(', ');
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE leads
      MODIFY COLUMN origen ENUM(${enumSql([...new Set([...OLD_ORIGINS, ...NEW_ORIGINS])])}) NOT NULL
    `);

    await queryInterface.sequelize.query(
      `UPDATE leads SET origen = 'Email Marketing' WHERE origen = 'Email'`,
    );

    await queryInterface.sequelize.query(`
      ALTER TABLE leads
      MODIFY COLUMN origen ENUM(${enumSql(NEW_ORIGINS)}) NOT NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE leads
      MODIFY COLUMN origen ENUM(${enumSql([...new Set([...OLD_ORIGINS, ...NEW_ORIGINS])])}) NOT NULL
    `);

    await queryInterface.sequelize.query(
      `UPDATE leads SET origen = 'Email' WHERE origen = 'Email Marketing'`,
    );
    await queryInterface.sequelize.query(
      `UPDATE leads
       SET origen = 'Otro'
       WHERE origen IN ('Instagram & Facebook', 'Prospeccion directa')`,
    );

    await queryInterface.sequelize.query(`
      ALTER TABLE leads
      MODIFY COLUMN origen ENUM(${enumSql(OLD_ORIGINS)}) NOT NULL
    `);
  },
};
