'use strict';

/**
 * PASO 1 repair — ensure ouvs.sql_id_origen is nullable after migration 2.
 *
 * Environments that already ran the broken Sequelize changeColumn version of
 * 20260807120100 keep IS_NULLABLE=NO (and may have duplicate FKs). This
 * migration is idempotent: no-op when already nullable.
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
  return [...new Set(rows.map((r) => r.name))];
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
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

    // Guard: fail loudly if still NOT NULL
    if (!(await columnNullable(queryInterface, 'ouvs', 'sql_id_origen'))) {
      throw new Error(
        'ouvs.sql_id_origen is still NOT NULL after repair migration',
      );
    }
  },

  async down() {
    // Irreversible repair — leave nullable (Wave 1 requires it).
  },
};
