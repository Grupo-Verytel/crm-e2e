'use strict';

const REFERIDO_CHANNEL = 'REFERIDO';

function parseEnumValues(columnType) {
  if (typeof columnType !== 'string' || !columnType.startsWith('enum(')) {
    return [];
  }
  return [...columnType.matchAll(/'((?:[^']|'')*)'/g)].map((match) =>
    match[1].replace(/''/g, "'"),
  );
}

async function addEnumValue(queryInterface, table, column, value) {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT COLUMN_TYPE, IS_NULLABLE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
        AND COLUMN_NAME = :column
    `,
    { replacements: { table, column } },
  );
  const meta = rows[0];
  if (!meta) {
    return;
  }

  const existing = parseEnumValues(meta.COLUMN_TYPE);
  if (existing.includes(value)) {
    return;
  }

  const sqlEnum = [...existing, value]
    .map((item) => `'${String(item).replace(/'/g, "''")}'`)
    .join(', ');
  const nullSql = meta.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
  await queryInterface.sequelize.query(
    `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ENUM(${sqlEnum}) ${nullSql}`,
  );
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addEnumValue(queryInterface, 'leads', 'canal_origen', REFERIDO_CHANNEL);

    const table = await queryInterface.describeTable('leads');
    if (!table.referrer_name) {
      await queryInterface.addColumn('leads', 'referrer_name', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('leads');
    if (table.referrer_name) {
      await queryInterface.removeColumn('leads', 'referrer_name');
    }
  },
};
