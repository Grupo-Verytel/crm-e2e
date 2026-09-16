'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('ouvs');

    if (!table.origen) {
      await queryInterface.addColumn('ouvs', 'origen', {
        type: Sequelize.STRING(80),
        allowNull: true,
      });
    }

    if (!table.canal_origen) {
      await queryInterface.addColumn('ouvs', 'canal_origen', {
        type: Sequelize.STRING(80),
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE ouvs AS ouv
      INNER JOIN sqls AS sql_row
        ON sql_row.sql_id = ouv.sql_id_origen
      INNER JOIN mqls AS mql
        ON mql.mql_id = sql_row.mql_id
      INNER JOIN leads AS lead_row
        ON lead_row.lead_id = mql.lead_id
      SET
        ouv.origen = lead_row.origen,
        ouv.canal_origen = lead_row.canal_origen
      WHERE ouv.sql_id_origen IS NOT NULL
    `);
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('ouvs');
    if (table.canal_origen) {
      await queryInterface.removeColumn('ouvs', 'canal_origen');
    }
    if (table.origen) {
      await queryInterface.removeColumn('ouvs', 'origen');
    }
  },
};
