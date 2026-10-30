import { createRequire } from 'node:module';
import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { Sequelize } from 'sequelize';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const nodeRequire = createRequire(__filename);
const migration = nodeRequire(
  '../../../../database/migrations/20261029120000-reshape-marketing-dashboard-targets.js',
) as {
  up: (
    queryInterface: unknown,
    sequelizeLib: typeof Sequelize,
  ) => Promise<void>;
  down: (
    queryInterface: unknown,
    sequelizeLib: typeof Sequelize,
  ) => Promise<void>;
};

const TABLE = 'marketing_dashboard_targets';
const SNAPSHOT = 'marketing_dashboard_targets_legacy_snapshot';
const scratch = `${process.env.DB_DATABASE ?? 'crm'}_dg_migtest`.replace(
  /[^a-zA-Z0-9_]/g,
  '_',
);

const SEED = [
  ['11111111-1111-4111-8111-111111111111', 'annual', 10, 1, 1],
  ['22222222-2222-4222-8222-222222222222', 'quarter', 20, 2, 2],
  ['33333333-3333-4333-8333-333333333333', 'biweekly', 30, 4, 4],
  ['44444444-4444-4444-8444-444444444444', 'weekly', 50, 3, 3],
] as const;

describe('reshape marketing_dashboard_targets', () => {
  jest.setTimeout(120000);
  let sequelize: Sequelize;

  beforeAll(async () => {
    const admin = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
    });
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${scratch}\``);
    await admin.end();
    sequelize = new Sequelize({
      dialect: 'mysql',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: scratch,
      logging: false,
    });
  });

  afterAll(async () => {
    await sequelize.close();
    const admin = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
    });
    await admin.query(`DROP DATABASE IF EXISTS \`${scratch}\``);
    await admin.end();
  });

  beforeEach(async () => {
    await sequelize.query(`DROP TABLE IF EXISTS \`${SNAPSHOT}\``);
    await sequelize.query(`DROP TABLE IF EXISTS \`${TABLE}\``);
  });

  function queryInterface() {
    return sequelize.getQueryInterface();
  }

  async function columnNames(table: string): Promise<string[]> {
    const [rows] = await sequelize.query(
      `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = :schema AND TABLE_NAME = :table`,
      { replacements: { schema: scratch, table } },
    );
    return (rows as Array<{ name: string }>).map((row) => row.name);
  }

  async function tablePresent(table: string): Promise<boolean> {
    const [rows] = await sequelize.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = :schema AND TABLE_NAME = :table`,
      { replacements: { schema: scratch, table } },
    );
    return Number((rows as Array<{ cnt: number }>)[0].cnt) > 0;
  }

  async function liveCount(): Promise<number> {
    const [rows] = await sequelize.query(
      `SELECT COUNT(*) AS cnt FROM \`${TABLE}\` WHERE deleted_at IS NULL`,
    );
    return Number((rows as Array<{ cnt: number }>)[0].cnt);
  }

  async function createLegacy(): Promise<void> {
    await sequelize.query(`
      CREATE TABLE \`${TABLE}\` (
        target_id CHAR(36) NOT NULL PRIMARY KEY,
        period_type ENUM('annual','quarter','biweekly','weekly') NOT NULL,
        interactions INT NOT NULL DEFAULT 50,
        period_leads INT NOT NULL DEFAULT 3,
        converted_ouvs INT NOT NULL DEFAULT 3,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        deleted_at DATETIME NULL,
        UNIQUE KEY period_type (period_type)
      )
    `);
  }

  async function insertSeed(): Promise<void> {
    for (const [id, period, interactions, leads, ouvs] of SEED) {
      await sequelize.query(
        `INSERT INTO \`${TABLE}\`
         (target_id, period_type, interactions, period_leads, converted_ouvs, created_at, updated_at)
         VALUES (:id, :period, :interactions, :leads, :ouvs, '2026-09-18 00:00:00', '2026-09-18 00:00:00')`,
        { replacements: { id, period, interactions, leads, ouvs } },
      );
    }
  }

  it('T1: creates an empty new schema and down removes it', async () => {
    await migration.up(queryInterface(), Sequelize);
    expect(await columnNames(TABLE)).toEqual(
      expect.arrayContaining([
        'fiscal_year',
        'quarter',
        'metric',
        'weekly_target',
        'active_marker',
      ]),
    );
    expect(await columnNames(TABLE)).not.toContain('period_type');
    expect(await liveCount()).toBe(0);
    expect(await tablePresent(SNAPSHOT)).toBe(false);

    await migration.up(queryInterface(), Sequelize);
    expect(await liveCount()).toBe(0);

    await migration.down(queryInterface(), Sequelize);
    expect(await tablePresent(TABLE)).toBe(false);
    expect(await tablePresent(SNAPSHOT)).toBe(false);

    await migration.up(queryInterface(), Sequelize);
    expect(await liveCount()).toBe(0);
    expect(await columnNames(TABLE)).toContain('weekly_target');
  });

  it('T2: transforms the old grain and down restores the original rows', async () => {
    await createLegacy();
    await insertSeed();
    await migration.up(queryInterface(), Sequelize);

    expect(await liveCount()).toBe(0);
    const columns = await columnNames(TABLE);
    expect(columns).not.toContain('period_type');
    expect(columns).not.toContain('interactions');
    expect(columns).toEqual(
      expect.arrayContaining([
        'fiscal_year',
        'metric',
        'weekly_target',
        'active_marker',
      ]),
    );
    const [main] = await sequelize.query(
      `SELECT weekly_target, deleted_at FROM \`${TABLE}\``,
    );
    for (const row of main as Array<{
      weekly_target: number;
      deleted_at: Date | null;
    }>) {
      expect(row.deleted_at).not.toBeNull();
      expect(Number(row.weekly_target)).toBe(0);
    }
    const [snapshot] = await sequelize.query(
      `SELECT target_id, period_type, interactions, period_leads, converted_ouvs, deleted_at
       FROM \`${SNAPSHOT}\` ORDER BY period_type`,
    );
    expect(snapshot).toHaveLength(4);

    await migration.up(queryInterface(), Sequelize);
    const [snapshotAgain] = await sequelize.query(
      `SELECT COUNT(*) AS cnt FROM \`${SNAPSHOT}\``,
    );
    expect(Number((snapshotAgain as Array<{ cnt: number }>)[0].cnt)).toBe(4);
    expect(await liveCount()).toBe(0);

    await migration.down(queryInterface(), Sequelize);
    expect(await tablePresent(SNAPSHOT)).toBe(false);
    const [restored] = await sequelize.query(
      `SELECT target_id, period_type, interactions, period_leads, converted_ouvs, deleted_at
       FROM \`${TABLE}\` ORDER BY period_type`,
    );
    expect(restored).toEqual([
      expect.objectContaining({
        target_id: SEED[0][0],
        period_type: 'annual',
        interactions: 10,
        period_leads: 1,
        converted_ouvs: 1,
        deleted_at: null,
      }),
      expect.objectContaining({
        target_id: SEED[1][0],
        period_type: 'quarter',
        interactions: 20,
        period_leads: 2,
        converted_ouvs: 2,
        deleted_at: null,
      }),
      expect.objectContaining({
        target_id: SEED[2][0],
        period_type: 'biweekly',
        interactions: 30,
        period_leads: 4,
        converted_ouvs: 4,
        deleted_at: null,
      }),
      expect.objectContaining({
        target_id: SEED[3][0],
        period_type: 'weekly',
        interactions: 50,
        period_leads: 3,
        converted_ouvs: 3,
        deleted_at: null,
      }),
    ]);

    await migration.up(queryInterface(), Sequelize);
    expect(await liveCount()).toBe(0);
  });

  it('T3: a second up keeps a live goal on the new schema', async () => {
    await migration.up(queryInterface(), Sequelize);
    await sequelize.query(
      `INSERT INTO \`${TABLE}\`
       (target_id, fiscal_year, quarter, metric, weekly_target, created_at, updated_at)
       VALUES ('55555555-5555-4555-8555-555555555555', 2026, 2, 'INTERACTIONS', 8, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
    );
    await migration.up(queryInterface(), Sequelize);
    const [rows] = await sequelize.query(
      `SELECT weekly_target FROM \`${TABLE}\` WHERE deleted_at IS NULL`,
    );
    expect(
      Number((rows as Array<{ weekly_target: number }>)[0].weekly_target),
    ).toBe(8);
    expect(await tablePresent(SNAPSHOT)).toBe(false);
  });

  it('T4: down refuses to run while a live goal exists', async () => {
    await migration.up(queryInterface(), Sequelize);
    await sequelize.query(
      `INSERT INTO \`${TABLE}\`
       (target_id, fiscal_year, quarter, metric, weekly_target, created_at, updated_at)
       VALUES ('55555555-5555-4555-8555-555555555555', 2026, 2, 'INTERACTIONS', 8, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
    );
    await expect(migration.down(queryInterface(), Sequelize)).rejects.toThrow(
      'Down bloqueado: hay metas de demanda vivas.',
    );
    const [rows] = await sequelize.query(
      `SELECT weekly_target FROM \`${TABLE}\` WHERE deleted_at IS NULL`,
    );
    expect(
      Number((rows as Array<{ weekly_target: number }>)[0].weekly_target),
    ).toBe(8);
  });

  it('T5: up resumes a half-transformed legacy table without duplicating the snapshot', async () => {
    await createLegacy();
    await insertSeed();
    await sequelize.query(`
      CREATE TABLE \`${SNAPSHOT}\` AS
      SELECT target_id, period_type, interactions, period_leads, converted_ouvs,
             created_at, updated_at, deleted_at
      FROM \`${TABLE}\`
    `);
    await sequelize.query(
      `ALTER TABLE \`${TABLE}\` ADD COLUMN fiscal_year SMALLINT NULL`,
    );
    await sequelize.query(
      `ALTER TABLE \`${TABLE}\` ADD COLUMN quarter TINYINT NULL`,
    );
    await sequelize.query(
      `ALTER TABLE \`${TABLE}\` ADD COLUMN metric ENUM('INTERACTIONS','LEADS','CONVERTED_OUV') NULL`,
    );
    await sequelize.query(
      `ALTER TABLE \`${TABLE}\` ADD COLUMN weekly_target INT NULL`,
    );

    await migration.up(queryInterface(), Sequelize);

    expect(await liveCount()).toBe(0);
    expect(await columnNames(TABLE)).not.toContain('period_type');
    const [snapshot] = await sequelize.query(
      `SELECT COUNT(DISTINCT target_id) AS cnt FROM \`${SNAPSHOT}\``,
    );
    expect(Number((snapshot as Array<{ cnt: number }>)[0].cnt)).toBe(4);
  });
});
