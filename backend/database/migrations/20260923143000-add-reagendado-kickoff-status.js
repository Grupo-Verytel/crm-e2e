'use strict';

function enumSql(values) {
  return values.map((value) => `'${value.replace(/'/g, "''")}'`).join(', ');
}

const OLD_STATUSES = ['Programado', 'Realizado', 'Cancelado'];
const NEW_STATUSES = ['Programado', 'Reagendado', 'Realizado', 'Cancelado'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE kickoffs
      MODIFY COLUMN status ENUM(${enumSql(NEW_STATUSES)}) NOT NULL DEFAULT 'Programado'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE kickoffs SET status = 'Programado' WHERE status = 'Reagendado'
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE kickoffs
      MODIFY COLUMN status ENUM(${enumSql(OLD_STATUSES)}) NOT NULL DEFAULT 'Programado'
    `);
  },
};
