'use strict';

/**
 * PASO 1 / migration 2 of 8 — make ouvs.sql_id_origen nullable (Vías 2/3/4).
 *
 * Sequelize changeColumn + FK on MySQL often leaves the column NOT NULL and can
 * duplicate FKs. Use raw ALTER: drop FKs on the column → MODIFY NULL → re-add one FK.
 * UNIQUE index is preserved (MySQL allows multiple NULLs).
 */

async function columnNullable(queryInterface, table, column) {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT IS_NULLABLE AS is_nullable
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
        AND COLUMN_NAME = :column
    `,
    { replacements: { table, column } },
  );
  return rows[0]?.is_nullable === 'YES';
}

async function fkNamesForColumn(queryInterface, table, column) {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT CONSTRAINT_NAME AS name
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
        AND COLUMN_NAME = :column
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `,
    { replacements: { table, column } },
  );
  return rows.map((r) => r.name);
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    if (await columnNullable(queryInterface, 'ouvs', 'sql_id_origen')) {
      return;
    }

    const fks = await fkNamesForColumn(queryInterface, 'ouvs', 'sql_id_origen');
    for (const name of fks) {
      await queryInterface.sequelize.query(
        `ALTER TABLE ouvs DROP FOREIGN KEY \`${name}\``,
      );
    }

    await queryInterface.sequelize.query(
      `ALTER TABLE ouvs MODIFY sql_id_origen CHAR(36) NULL`,
    );

    await queryInterface.sequelize.query(`
      ALTER TABLE ouvs
        ADD CONSTRAINT ouvs_sql_id_origen_fk
        FOREIGN KEY (sql_id_origen) REFERENCES sqls (sql_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    `);
  },

  async down(queryInterface) {
    const fks = await fkNamesForColumn(queryInterface, 'ouvs', 'sql_id_origen');
    for (const name of fks) {
      await queryInterface.sequelize.query(
        `ALTER TABLE ouvs DROP FOREIGN KEY \`${name}\``,
      );
    }

    await queryInterface.sequelize.query(
      `ALTER TABLE ouvs MODIFY sql_id_origen CHAR(36) NOT NULL`,
    );

    await queryInterface.sequelize.query(`
      ALTER TABLE ouvs
        ADD CONSTRAINT ouvs_sql_id_origen_fk
        FOREIGN KEY (sql_id_origen) REFERENCES sqls (sql_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    `);
  },
};
