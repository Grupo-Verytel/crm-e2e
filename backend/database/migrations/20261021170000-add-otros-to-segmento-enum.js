'use strict';

const OTROS = 'Otros';
const TABLES = ['leads', 'ouvs'];

function quoteEnum(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function readEnum(queryInterface, table) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT COLUMN_TYPE AS columnType, IS_NULLABLE AS isNullable
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = 'segmento'`,
    { replacements: [table] },
  );
  const row = rows[0];
  if (!row) {
    throw new Error(`Missing column ${table}.segmento`);
  }

  const match = String(row.columnType).match(/^enum\((.*)\)$/i);
  if (!match) {
    throw new Error(`${table}.segmento is not an ENUM (${row.columnType})`);
  }

  const values = [];
  const pattern = /'((?:[^']|'')*)'/g;
  let found = pattern.exec(match[1]);
  while (found) {
    values.push(found[1].replace(/''/g, "'"));
    found = pattern.exec(match[1]);
  }

  return {
    values,
    nullSql: row.isNullable === 'YES' ? 'NULL' : 'NOT NULL',
  };
}

async function writeEnum(queryInterface, table, values, nullSql) {
  const list = values.map(quoteEnum).join(', ');
  await queryInterface.sequelize.query(
    `ALTER TABLE \`${table}\` MODIFY COLUMN \`segmento\` ENUM(${list}) ${nullSql}`,
  );
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    for (const table of TABLES) {
      const { values, nullSql } = await readEnum(queryInterface, table);
      if (values.includes(OTROS)) {
        continue;
      }
      await writeEnum(queryInterface, table, [...values, OTROS], nullSql);
    }
  },

  async down(queryInterface) {
    for (const table of TABLES) {
      const { values, nullSql } = await readEnum(queryInterface, table);
      if (!values.includes(OTROS)) {
        continue;
      }

      const [rows] = await queryInterface.sequelize.query(
        `SELECT COUNT(*) AS total FROM \`${table}\` WHERE \`segmento\` = ?`,
        { replacements: [OTROS] },
      );
      const total = Number(rows[0].total);
      if (total > 0) {
        throw new Error(
          `Cannot remove ${table}.segmento value Otros while ${total} row(s) use it`,
        );
      }

      await writeEnum(
        queryInterface,
        table,
        values.filter((value) => value !== OTROS),
        nullSql,
      );
    }
  },
};
