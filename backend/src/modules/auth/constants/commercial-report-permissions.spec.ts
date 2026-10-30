import { createRequire } from 'node:module';

const nodeRequire = createRequire(__filename);

const adminMigration = nodeRequire(
  '../../../../database/migrations/20261028170000-commercial-report-permissions.js',
) as {
  up: (queryInterface: { sequelize: { query: jest.Mock } }) => Promise<void>;
  down: (queryInterface: { sequelize: { query: jest.Mock } }) => Promise<void>;
};

const gerenteMigration = nodeRequire(
  '../../../../database/migrations/20261028170100-gerente-comercial-commercial-report.js',
) as {
  up: (queryInterface: { sequelize: { query: jest.Mock } }) => Promise<void>;
  down: (queryInterface: { sequelize: { query: jest.Mock } }) => Promise<void>;
};

const RULE = { action: 'read', subject: 'CommercialReport' };

function queryInterface(
  rows: Array<{ role_id: string; permissions: unknown }>,
) {
  const query = jest.fn().mockResolvedValue([rows]);
  return { sequelize: { query }, query };
}

function updatedPermissions(query: jest.Mock, callIndex: number) {
  const calls = query.mock.calls as Array<
    [string, { replacements: { permissions: string } }]
  >;
  return JSON.parse(calls[callIndex][1].replacements.permissions) as Array<{
    action: string;
    subject: string;
  }>;
}

describe('CommercialReport permission migrations', () => {
  const before = [
    { action: 'read', subject: 'Opportunity' },
    { action: 'update', subject: 'Account' },
  ];

  it('adds read CommercialReport to Admin and SoporteComercial without dropping rules', async () => {
    const db = queryInterface([
      { role_id: 'admin', permissions: JSON.stringify(before) },
      { role_id: 'soporte', permissions: JSON.stringify(before) },
    ]);

    await adminMigration.up(db);

    for (const index of [1, 2]) {
      const next = updatedPermissions(db.query, index);
      expect(next.slice(0, before.length)).toEqual(before);
      expect(next).toContainEqual(RULE);
      expect(
        next.filter((rule) => rule.subject === 'CommercialReport'),
      ).toHaveLength(1);
    }
  });

  it('does not duplicate the rule on Admin or SoporteComercial', async () => {
    const db = queryInterface([
      { role_id: 'admin', permissions: JSON.stringify([...before, RULE]) },
    ]);

    await adminMigration.up(db);

    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('down removes only read CommercialReport from Admin and SoporteComercial', async () => {
    const db = queryInterface([
      {
        role_id: 'admin',
        permissions: JSON.stringify([
          ...before,
          RULE,
          { action: 'read', subject: 'Lead' },
        ]),
      },
    ]);

    await adminMigration.down(db);

    expect(updatedPermissions(db.query, 1)).toEqual([
      ...before,
      { action: 'read', subject: 'Lead' },
    ]);
  });

  it('adds read CommercialReport to the live Gerente Comercial row', async () => {
    const db = queryInterface([
      { role_id: 'gerente', permissions: JSON.stringify([...before]) },
    ]);

    await gerenteMigration.up(db);

    const next = updatedPermissions(db.query, 1);
    expect(next.slice(0, before.length)).toEqual(before);
    expect(next).toContainEqual(RULE);
  });

  it('does not duplicate the rule and does not fail when Gerente Comercial is missing', async () => {
    const present = queryInterface([
      { role_id: 'gerente', permissions: JSON.stringify([...before, RULE]) },
    ]);
    await gerenteMigration.up(present);
    expect(present.query).toHaveBeenCalledTimes(1);

    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const missing = queryInterface([]);
    await expect(gerenteMigration.up(missing)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('down removes only read CommercialReport from Gerente Comercial', async () => {
    const db = queryInterface([
      { role_id: 'gerente', permissions: JSON.stringify([...before, RULE]) },
    ]);

    await gerenteMigration.down(db);

    expect(updatedPermissions(db.query, 1)).toEqual(before);
  });
});
