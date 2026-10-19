'use strict';

async function hasColumn(queryInterface, table, column) {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
        AND COLUMN_NAME = :column
    `,
    { replacements: { table, column } },
  );
  return rows.length > 0;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (await hasColumn(queryInterface, 'accounts', 'is_high_value')) {
      return;
    }

    await queryInterface.addColumn('accounts', 'is_high_value', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    if (!(await hasColumn(queryInterface, 'accounts', 'is_high_value'))) {
      return;
    }

    await queryInterface.removeColumn('accounts', 'is_high_value');
  },
};
