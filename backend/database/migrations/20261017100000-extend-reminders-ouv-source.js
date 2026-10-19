'use strict';

/**
 * OUV reminders share `reminders` with lead/SQL reminders.
 * Exactly one of interaction_id / ouv_interaction_id must be set.
 * MySQL rejects a CHECK on a column whose foreign key uses ON UPDATE CASCADE,
 * so reminders_ibfk_2 is recreated with ON UPDATE RESTRICT.
 * `down` restores ON UPDATE CASCADE.
 *
 * Each step reads information_schema and skips work that is already applied,
 * so a partial failure (DDL commits the DROP of reminders_ibfk_2, then the
 * rest rolls back, and SequelizeMeta is not written) can be re-run.
 * @type {import('sequelize-cli').Migration}
 */

const TABLE = 'reminders';

const NEW_COLUMNS = [
  ['ouv_interaction_id',
    'ouv_interaction_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL AFTER interaction_id'],
  ['completed_at', 'completed_at DATETIME NULL AFTER status'],
  ['outlook_event_id', 'outlook_event_id VARCHAR(255) NULL AFTER completed_at'],
  ['outlook_sync_status',
    "outlook_sync_status ENUM('NOT_REQUIRED','PENDING','SYNCED','FAILED') NOT NULL DEFAULT 'NOT_REQUIRED' AFTER outlook_event_id"],
  ['outlook_sync_attempts',
    'outlook_sync_attempts INT NOT NULL DEFAULT 0 AFTER outlook_sync_status'],
  ['outlook_synced_at', 'outlook_synced_at DATETIME NULL AFTER outlook_sync_attempts'],
  ['outlook_last_error', 'outlook_last_error VARCHAR(500) NULL AFTER outlook_synced_at'],
];

const NEW_INDEXES = [
  {
    name: 'idx_reminders_ouv_followup',
    ddl: 'idx_reminders_ouv_followup (ouv_interaction_id, completed_at, status, event_at)',
    columns: ['ouv_interaction_id', 'completed_at', 'status', 'event_at'],
  },
  {
    name: 'idx_reminders_user_due',
    ddl: 'idx_reminders_user_due (user_id, completed_at, status, event_at)',
    columns: ['user_id', 'completed_at', 'status', 'event_at'],
  },
  {
    name: 'idx_reminders_outlook_sync',
    ddl: 'idx_reminders_outlook_sync (outlook_sync_status)',
    columns: ['outlook_sync_status'],
  },
];

const RESTRICT_FK = {
  name: 'reminders_ibfk_2',
  ddl: `CONSTRAINT reminders_ibfk_2
    FOREIGN KEY (interaction_id) REFERENCES interactions (interaction_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT`,
};

const CASCADE_FK_DDL = `CONSTRAINT reminders_ibfk_2
  FOREIGN KEY (interaction_id) REFERENCES interactions (interaction_id)
  ON DELETE RESTRICT ON UPDATE CASCADE`;

const OUV_FK = {
  name: 'fk_reminders_ouv_interaction',
  ddl: `CONSTRAINT fk_reminders_ouv_interaction
    FOREIGN KEY (ouv_interaction_id) REFERENCES ouv_interactions (ouv_interaction_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT`,
};

function isRestrictRule(rule) {
  return rule === 'RESTRICT' || rule === 'NO ACTION';
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

async function constraintType(queryInterface, table, name) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT CONSTRAINT_TYPE AS constraintType
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = :table
      AND CONSTRAINT_NAME = :name
    `,
    { replacements: { table, name } },
  );
  return rows[0]?.constraintType ?? null;
}

async function referentialRules(queryInterface, table, name) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT UPDATE_RULE AS updateRule, DELETE_RULE AS deleteRule
    FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = :table
      AND CONSTRAINT_NAME = :name
    `,
    { replacements: { table, name } },
  );
  return rows[0] ?? null;
}

async function indexColumns(queryInterface, table, name) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT COLUMN_NAME AS columnName
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = :table
      AND INDEX_NAME = :name
    ORDER BY SEQ_IN_INDEX
    `,
    { replacements: { table, name } },
  );
  return rows.map((row) => row.columnName);
}

async function ensureIndex(queryInterface, spec) {
  const current = await indexColumns(queryInterface, TABLE, spec.name);
  const matches =
    current.length === spec.columns.length &&
    current.every((column, index) => column === spec.columns[index]);
  if (matches) {
    return;
  }
  if (current.length > 0) {
    await queryInterface.sequelize.query(
      `ALTER TABLE ${TABLE} DROP INDEX ${spec.name}`,
    );
  }
  await queryInterface.sequelize.query(
    `ALTER TABLE ${TABLE} ADD INDEX ${spec.ddl}`,
  );
}

async function countNullInteractionSources(queryInterface) {
  const [rows] = await queryInterface.sequelize.query(`
    SELECT COUNT(*) AS cnt
    FROM reminders
    WHERE interaction_id IS NULL
  `);
  return Number(rows[0]?.cnt ?? 0);
}

async function ouvInteractionIdColumn(queryInterface) {
  const [rows] = await queryInterface.sequelize.query(`
    SELECT COLUMN_TYPE AS columnType,
           CHARACTER_SET_NAME AS characterSetName,
           COLLATION_NAME AS collationName
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'ouv_interactions'
      AND COLUMN_NAME = 'ouv_interaction_id'
  `);
  return rows[0] ?? null;
}

function assertPreconditions(nullSources, column) {
  if (nullSources !== 0) {
    throw new Error(
      `Migration aborted: reminders has ${nullSources} row(s) with interaction_id IS NULL. ` +
        'Each existing reminder must reference an interaction before chk_reminders_single_source can be added.',
    );
  }

  if (!column) {
    throw new Error(
      'Migration aborted: ouv_interactions.ouv_interaction_id was not found. ' +
        'reminders.ouv_interaction_id cannot be added without that primary key.',
    );
  }

  const columnType = String(column.columnType).toLowerCase();
  const characterSet = String(column.characterSetName).toLowerCase();
  const collation = String(column.collationName).toLowerCase();
  if (
    columnType !== 'char(36)' ||
    characterSet !== 'utf8mb4' ||
    collation !== 'utf8mb4_0900_ai_ci'
  ) {
    throw new Error(
      'Migration aborted: ouv_interactions.ouv_interaction_id must be ' +
        `CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci. Found ` +
        `COLUMN_TYPE=${column.columnType} CHARACTER_SET=${column.characterSetName} ` +
        `COLLATION=${column.collationName}.`,
    );
  }
}

async function ensureForeignKey(queryInterface, spec, wantRestrict) {
  const rules = await referentialRules(queryInterface, TABLE, spec.name);
  const matches = rules
    && (wantRestrict
      ? isRestrictRule(rules.updateRule) && isRestrictRule(rules.deleteRule)
      : rules.updateRule === 'CASCADE' && isRestrictRule(rules.deleteRule));
  if (matches) {
    return;
  }

  if (await constraintType(queryInterface, TABLE, spec.name)) {
    await queryInterface.sequelize.query(
      `ALTER TABLE ${TABLE} DROP FOREIGN KEY ${spec.name}`,
    );
  }

  await queryInterface.sequelize.query(
    `ALTER TABLE ${TABLE} ADD ${spec.ddl}`,
  );
}

async function dropConstraintIfPresent(queryInterface, name, kind) {
  const type = await constraintType(queryInterface, TABLE, name);
  if (!type) {
    return;
  }
  const keyword = kind === 'index' ? 'INDEX' : kind === 'check' ? 'CHECK' : 'FOREIGN KEY';
  await queryInterface.sequelize.query(
    `ALTER TABLE ${TABLE} DROP ${keyword} ${name}`,
  );
}

module.exports = {
  async up(queryInterface) {
    const checkAlreadyApplied = await constraintType(
      queryInterface,
      TABLE,
      'chk_reminders_single_source',
    );
    if (checkAlreadyApplied !== 'CHECK') {
      const nullSources = await countNullInteractionSources(queryInterface);
      const column = await ouvInteractionIdColumn(queryInterface);
      assertPreconditions(nullSources, column);
    }

    await ensureForeignKey(queryInterface, RESTRICT_FK, true);

    for (const [name, ddl] of NEW_COLUMNS) {
      if (await columnExists(queryInterface, TABLE, name)) {
        continue;
      }
      await queryInterface.sequelize.query(
        `ALTER TABLE ${TABLE} ADD COLUMN ${ddl}`,
      );
    }

    // The follow-up index leads with ouv_interaction_id, so MySQL uses it for
    // the FK instead of creating a second index with the constraint name.
    await ensureIndex(queryInterface, NEW_INDEXES[0]);

    await ensureForeignKey(queryInterface, OUV_FK, true);

    if (
      (await constraintType(queryInterface, TABLE, 'chk_reminders_single_source')) !==
      'CHECK'
    ) {
      await queryInterface.sequelize.query(`
        ALTER TABLE ${TABLE}
          ADD CONSTRAINT chk_reminders_single_source
          CHECK ((interaction_id IS NOT NULL) + (ouv_interaction_id IS NOT NULL) = 1)
      `);
    }

    for (const spec of NEW_INDEXES.slice(1)) {
      await ensureIndex(queryInterface, spec);
    }
  },

  async down(queryInterface) {
    // idx_reminders_ouv_followup is the index behind fk_reminders_ouv_interaction.
    await dropConstraintIfPresent(
      queryInterface,
      OUV_FK.name,
      'foreignKey',
    );
    await dropConstraintIfPresent(
      queryInterface,
      'chk_reminders_single_source',
      'check',
    );

    for (const spec of NEW_INDEXES) {
      const current = await indexColumns(queryInterface, TABLE, spec.name);
      if (current.length === 0) {
        continue;
      }
      await queryInterface.sequelize.query(
        `ALTER TABLE ${TABLE} DROP INDEX ${spec.name}`,
      );
    }

    for (const [name] of [...NEW_COLUMNS].reverse()) {
      if (!(await columnExists(queryInterface, TABLE, name))) {
        continue;
      }
      await queryInterface.sequelize.query(
        `ALTER TABLE ${TABLE} DROP COLUMN ${name}`,
      );
    }

    await ensureForeignKey(
      queryInterface,
      { name: 'reminders_ibfk_2', ddl: CASCADE_FK_DDL },
      false,
    );
  },
};
