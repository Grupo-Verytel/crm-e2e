'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const tables = await listTables(queryInterface);

    if (tables.includes('sql_cita_events')) {
      await queryInterface.renameTable('sql_cita_events', 'sql_appointment_events');
    }
    if (!tables.includes('sql_appointment_events') && !tables.includes('sql_cita_events')) {
      return;
    }

    const columns = await queryInterface.describeTable('sql_appointment_events');
    if (columns.sql_cita_event_id && !columns.sql_appointment_event_id) {
      await queryInterface.renameColumn(
        'sql_appointment_events',
        'sql_cita_event_id',
        'sql_appointment_event_id',
      );
    }

    await renameIndexIfExists(
      sequelize,
      'sql_appointment_events',
      'idx_sql_cita_events_sql_id',
      'idx_sql_appointment_events_sql_id',
    );
    await renameIndexIfExists(
      sequelize,
      'sql_appointment_events',
      'idx_sql_cita_events_event_type',
      'idx_sql_appointment_events_event_type',
    );
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const tables = await listTables(queryInterface);
    if (!tables.includes('sql_appointment_events')) {
      return;
    }

    await renameIndexIfExists(
      sequelize,
      'sql_appointment_events',
      'idx_sql_appointment_events_sql_id',
      'idx_sql_cita_events_sql_id',
    );
    await renameIndexIfExists(
      sequelize,
      'sql_appointment_events',
      'idx_sql_appointment_events_event_type',
      'idx_sql_cita_events_event_type',
    );

    const columns = await queryInterface.describeTable('sql_appointment_events');
    if (columns.sql_appointment_event_id && !columns.sql_cita_event_id) {
      await queryInterface.renameColumn(
        'sql_appointment_events',
        'sql_appointment_event_id',
        'sql_cita_event_id',
      );
    }

    await queryInterface.renameTable('sql_appointment_events', 'sql_cita_events');
  },
};

async function listTables(queryInterface) {
  const tables = await queryInterface.showAllTables();
  return tables.map((table) =>
    typeof table === 'string' ? table : table.tableName || table.name,
  );
}

async function renameIndexIfExists(sequelize, table, from, to) {
  const [rows] = await sequelize.query(
    `SHOW INDEX FROM \`${table}\` WHERE Key_name = :from`,
    { replacements: { from } },
  );
  if (!rows.length) {
    return;
  }
  await sequelize.query(
    `ALTER TABLE \`${table}\` RENAME INDEX \`${from}\` TO \`${to}\``,
  );
}
