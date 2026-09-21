'use strict';

const ORIGINAL_TYPES = ['Economica', 'Tecnica', 'Fabrica'];
const EXPANDED_TYPES = [...ORIGINAL_TYPES, 'Usuario', 'Coach'];

function enumSql(values) {
  return values.map((value) => `'${value.replace(/'/g, "''")}'`).join(', ');
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const table = await queryInterface.describeTable('lead_contacts');
    if (!table.tipo_influencia) {
      return;
    }

    await queryInterface.sequelize.query(`
      ALTER TABLE lead_contacts
      MODIFY COLUMN tipo_influencia ENUM(${enumSql(EXPANDED_TYPES)}) NULL
    `);
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('lead_contacts');
    if (!table.tipo_influencia) {
      return;
    }

    await queryInterface.sequelize.query(
      `UPDATE lead_contacts
       SET tipo_influencia = NULL
       WHERE tipo_influencia IN ('Usuario', 'Coach')`,
    );

    await queryInterface.sequelize.query(`
      ALTER TABLE lead_contacts
      MODIFY COLUMN tipo_influencia ENUM(${enumSql(ORIGINAL_TYPES)}) NULL
    `);
  },
};
