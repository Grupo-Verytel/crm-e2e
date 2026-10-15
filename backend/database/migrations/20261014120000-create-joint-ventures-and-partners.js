'use strict';

/**
 * Uniones temporales y aliados como catálogos persistentes (DR 2026-10 UT y
 * aliados).
 *
 * El diseño de `/offers` guardaba ambos catálogos en `localStorage`: cada
 * navegador veía su propia lista y el NIT duplicado solo se detectaba en el
 * equipo que lo creó. Aquí pasan a MySQL, y cada fila de empresa ejecutora
 * del expediente apunta a su UT o aliado.
 *
 * Además, el % de ingresos admite un decimal (33.3): `participacion_pct` pasa
 * de SMALLINT a DECIMAL(4,1) en `won_sale_members` y en `won_sales`.
 *
 * Tablas y columnas nuevas en inglés (DR 2026-08 convención de nombres); los
 * valores de ENUM siguen en español.
 */

async function tableExists(queryInterface, table) {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT COUNT(*) AS cnt
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
    `,
    { replacements: { table } },
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
}

async function columnExists(queryInterface, table, column) {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT COUNT(*) AS cnt
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
        AND COLUMN_NAME = :column
    `,
    { replacements: { table, column } },
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
}

const CATALOGS = [
  { table: 'joint_ventures', pk: 'joint_venture_id', fk: 'joint_venture_id' },
  { table: 'partners', pk: 'partner_id', fk: 'partner_id' },
];

const EMPRESAS_ANTES = ['Frisson', 'Verytel', 'UT'];
const EMPRESAS_DESPUES = ['Frisson', 'Verytel', 'UT', 'Aliado'];

const PCT_TABLES = ['won_sale_members', 'won_sales'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    for (const { table, pk } of CATALOGS) {
      if (await tableExists(queryInterface, table)) continue;
      await queryInterface.createTable(table, {
        [pk]: { type: Sequelize.CHAR(36), primaryKey: true, allowNull: false },
        tax_id: { type: Sequelize.STRING(15), allowNull: false },
        verification_digit: { type: Sequelize.CHAR(1), allowNull: false },
        name: { type: Sequelize.STRING(160), allowNull: false },
        active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        created_by: { type: Sequelize.CHAR(36), allowNull: true },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      });
      // Un NIT, una fila: incluye las borradas, que se restauran en vez de
      // duplicarse.
      await queryInterface.addIndex(table, ['tax_id'], {
        name: `uq_${table}_tax_id`,
        unique: true,
      });
    }

    for (const { table, pk, fk } of CATALOGS) {
      if (await columnExists(queryInterface, 'won_sale_members', fk)) continue;
      await queryInterface.addColumn('won_sale_members', fk, {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: table, key: pk },
        onUpdate: 'CASCADE',
        // El catálogo se borra lógicamente; un borrado físico no debe dejar
        // expedientes apuntando a nada.
        onDelete: 'RESTRICT',
      });
    }

    await queryInterface.changeColumn('won_sale_members', 'empresa', {
      type: Sequelize.ENUM(...EMPRESAS_DESPUES),
      allowNull: true,
    });

    for (const table of PCT_TABLES) {
      await queryInterface.changeColumn(table, 'participacion_pct', {
        type: Sequelize.DECIMAL(4, 1),
        allowNull: false,
        defaultValue: 0,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    for (const table of PCT_TABLES) {
      await queryInterface.sequelize.query(
        `UPDATE ${table} SET participacion_pct = ROUND(participacion_pct)`,
      );
      await queryInterface.changeColumn(table, 'participacion_pct', {
        type: Sequelize.SMALLINT,
        allowNull: false,
        defaultValue: 0,
      });
    }

    // Sin el valor en el ENUM, las filas Aliado quedan como socio externo.
    await queryInterface.sequelize.query(
      `UPDATE won_sale_members SET empresa = NULL WHERE empresa = 'Aliado'`,
    );
    await queryInterface.changeColumn('won_sale_members', 'empresa', {
      type: Sequelize.ENUM(...EMPRESAS_ANTES),
      allowNull: true,
    });

    for (const { table, fk } of CATALOGS) {
      if (await columnExists(queryInterface, 'won_sale_members', fk)) {
        await queryInterface.removeColumn('won_sale_members', fk);
      }
      if (await tableExists(queryInterface, table)) {
        await queryInterface.dropTable(table);
      }
    }
  },
};
