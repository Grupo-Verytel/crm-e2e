'use strict';

const TABLE = 'marketing_dashboard_targets';
const SNAPSHOT = 'marketing_dashboard_targets_legacy_snapshot';
const UNIQUE_INDEX = 'uq_marketing_dashboard_targets_active';
const PERIOD_TYPES = ['annual', 'quarter', 'biweekly', 'weekly'];
const METRICS = ['INTERACTIONS', 'LEADS', 'CONVERTED_OUV'];
const LIVE_DOWN_BLOCK = 'Down bloqueado: hay metas de demanda vivas.';
const ROWS_DOWN_BLOCK =
  'Down bloqueado: la tabla ya tiene filas del esquema nuevo.';

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
  return Number(rows[0]?.cnt ?? rows[0]?.CNT ?? 0) > 0;
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
  return Number(rows[0]?.cnt ?? rows[0]?.CNT ?? 0) > 0;
}

async function indexExists(queryInterface, table, indexName) {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT COUNT(*) AS cnt
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
        AND INDEX_NAME = :indexName
    `,
    { replacements: { table, indexName } },
  );
  return Number(rows[0]?.cnt ?? rows[0]?.CNT ?? 0) > 0;
}

async function countRows(queryInterface, table, onlyLive) {
  const where = onlyLive ? 'WHERE deleted_at IS NULL' : '';
  const [rows] = await queryInterface.sequelize.query(
    `SELECT COUNT(*) AS cnt FROM \`${table}\` ${where}`,
  );
  return Number(rows[0]?.cnt ?? rows[0]?.CNT ?? 0);
}

function legacyColumns(Sequelize) {
  return {
    target_id: {
      type: Sequelize.CHAR(36),
      allowNull: false,
      primaryKey: true,
    },
    period_type: {
      type: Sequelize.ENUM(...PERIOD_TYPES),
      allowNull: false,
      unique: true,
    },
    interactions: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 50,
    },
    period_leads: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 3,
    },
    converted_ouvs: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 3,
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
    },
    deleted_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
  };
}

async function createCurrentTable(queryInterface, Sequelize) {
  await queryInterface.createTable(TABLE, {
    target_id: {
      type: Sequelize.CHAR(36),
      allowNull: false,
      primaryKey: true,
    },
    fiscal_year: {
      type: Sequelize.SMALLINT,
      allowNull: false,
    },
    quarter: {
      type: Sequelize.TINYINT,
      allowNull: false,
    },
    metric: {
      type: Sequelize.ENUM(...METRICS),
      allowNull: false,
    },
    weekly_target: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
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
    deleted_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
  });
}

async function ensureActiveMarker(queryInterface) {
  if (await columnExists(queryInterface, TABLE, 'active_marker')) {
    return;
  }
  await queryInterface.sequelize.query(`
    ALTER TABLE \`${TABLE}\`
    ADD COLUMN active_marker TINYINT
    GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED
  `);
}

async function ensureUniqueIndex(queryInterface) {
  if (await indexExists(queryInterface, TABLE, UNIQUE_INDEX)) {
    return;
  }
  await queryInterface.addIndex(
    TABLE,
    ['fiscal_year', 'quarter', 'metric', 'active_marker'],
    { name: UNIQUE_INDEX, unique: true },
  );
}

async function dropUniqueIndexesOnColumn(queryInterface, table, column) {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT DISTINCT INDEX_NAME AS index_name
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
        AND COLUMN_NAME = :column
        AND NON_UNIQUE = 0
        AND INDEX_NAME <> 'PRIMARY'
    `,
    { replacements: { table, column } },
  );
  for (const row of rows) {
    const indexName = row.index_name ?? row.INDEX_NAME;
    if (indexName) {
      await queryInterface.removeIndex(table, indexName);
    }
  }
}

async function ensureSnapshot(queryInterface, Sequelize) {
  if (await tableExists(queryInterface, SNAPSHOT)) {
    return;
  }
  await queryInterface.createTable(SNAPSHOT, legacyColumns(Sequelize));
}

async function copyLegacyRows(queryInterface) {
  await queryInterface.sequelize.query(`
    INSERT INTO \`${SNAPSHOT}\` (
      target_id, period_type, interactions, period_leads, converted_ouvs,
      created_at, updated_at, deleted_at
    )
    SELECT
      m.target_id, m.period_type, m.interactions, m.period_leads, m.converted_ouvs,
      m.created_at, m.updated_at, m.deleted_at
    FROM \`${TABLE}\` m
    WHERE NOT EXISTS (
      SELECT 1 FROM \`${SNAPSHOT}\` s WHERE s.target_id = m.target_id
    )
  `);
}

async function addNullableGoalColumns(queryInterface, Sequelize) {
  const columns = {
    fiscal_year: { type: Sequelize.SMALLINT, allowNull: true },
    quarter: { type: Sequelize.TINYINT, allowNull: true },
    metric: { type: Sequelize.ENUM(...METRICS), allowNull: true },
    weekly_target: { type: Sequelize.INTEGER, allowNull: true },
  };
  for (const [name, spec] of Object.entries(columns)) {
    if (!(await columnExists(queryInterface, TABLE, name))) {
      await queryInterface.addColumn(TABLE, name, spec);
    }
  }
}

async function transformLegacy(queryInterface, Sequelize) {
  await ensureSnapshot(queryInterface, Sequelize);
  await copyLegacyRows(queryInterface);
  await queryInterface.sequelize.query(`
    UPDATE \`${TABLE}\`
    SET deleted_at = UTC_TIMESTAMP()
    WHERE deleted_at IS NULL
  `);
  await addNullableGoalColumns(queryInterface, Sequelize);
  await queryInterface.sequelize.query(`
    UPDATE \`${TABLE}\`
    SET fiscal_year = 2026,
        quarter = 1,
        metric = 'INTERACTIONS',
        weekly_target = 0
    WHERE fiscal_year IS NULL
       OR quarter IS NULL
       OR metric IS NULL
       OR weekly_target IS NULL
  `);
  await dropUniqueIndexesOnColumn(queryInterface, TABLE, 'period_type');
  for (const column of [
    'period_type',
    'interactions',
    'period_leads',
    'converted_ouvs',
  ]) {
    if (await columnExists(queryInterface, TABLE, column)) {
      await queryInterface.removeColumn(TABLE, column);
    }
  }
  await queryInterface.changeColumn(TABLE, 'fiscal_year', {
    type: Sequelize.SMALLINT,
    allowNull: false,
  });
  await queryInterface.changeColumn(TABLE, 'quarter', {
    type: Sequelize.TINYINT,
    allowNull: false,
  });
  await queryInterface.changeColumn(TABLE, 'metric', {
    type: Sequelize.ENUM(...METRICS),
    allowNull: false,
  });
  await queryInterface.changeColumn(TABLE, 'weekly_target', {
    type: Sequelize.INTEGER,
    allowNull: false,
  });
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, TABLE))) {
      await createCurrentTable(queryInterface, Sequelize);
    } else if (await columnExists(queryInterface, TABLE, 'period_type')) {
      await transformLegacy(queryInterface, Sequelize);
    } else if (!(await columnExists(queryInterface, TABLE, 'fiscal_year'))) {
      throw new Error(
        'marketing_dashboard_targets no tiene period_type ni fiscal_year.',
      );
    }

    await ensureActiveMarker(queryInterface);
    await ensureUniqueIndex(queryInterface);
  },

  async down(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, TABLE))) {
      return;
    }

    if ((await countRows(queryInterface, TABLE, true)) > 0) {
      throw new Error(LIVE_DOWN_BLOCK);
    }

    const hasSnapshot = await tableExists(queryInterface, SNAPSHOT);
    if (!hasSnapshot && (await countRows(queryInterface, TABLE, false)) > 0) {
      throw new Error(ROWS_DOWN_BLOCK);
    }

    if (hasSnapshot) {
      const [saved] = await queryInterface.sequelize.query(
        `SELECT * FROM \`${SNAPSHOT}\``,
      );
      await queryInterface.dropTable(TABLE);
      await queryInterface.createTable(TABLE, legacyColumns(Sequelize));
      if (saved.length > 0) {
        await queryInterface.bulkInsert(
          TABLE,
          saved.map((row) => ({
            target_id: row.target_id ?? row.TARGET_ID,
            period_type: row.period_type ?? row.PERIOD_TYPE,
            interactions: row.interactions ?? row.INTERACTIONS,
            period_leads: row.period_leads ?? row.PERIOD_LEADS,
            converted_ouvs: row.converted_ouvs ?? row.CONVERTED_OUVS,
            created_at: row.created_at ?? row.CREATED_AT,
            updated_at: row.updated_at ?? row.UPDATED_AT,
            deleted_at: row.deleted_at ?? row.DELETED_AT ?? null,
          })),
        );
      }
      await queryInterface.dropTable(SNAPSHOT);
      return;
    }

    await queryInterface.dropTable(TABLE);
  },
};
