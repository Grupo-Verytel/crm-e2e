import { createRequire } from 'node:module';
import { ForbiddenException } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { CaslAbilityFactory } from '../../auth/casl/casl-ability.factory';
import type { AppAbility } from '../../auth/casl/casl-ability.factory';
import { AuditAction } from '../../audit/models/audit-action.enum';
import { AuditHooksService } from '../../audit/services/audit-hooks.service';
import { Account } from '../models/account.model';
import { Person } from '../models/person.model';
import { AccountsService } from './accounts.service';

const nodeRequire = createRequire(__filename);
const { buildPermissions } = nodeRequire(
  '../../../../database/seeders/lib/role-permissions',
) as {
  buildPermissions: (roleName: string) => Array<{
    action: string;
    subject: string;
  }>;
};

const HIGH_VALUE_RULE = { action: 'manage_high_value', subject: 'Account' };
const FORBIDDEN = {
  code: 'FORBIDDEN',
  message: 'No tienes permiso para cambiar la marca de alto valor.',
};

const factory = new CaslAbilityFactory();

function abilityFor(roleName: string): AppAbility {
  return factory.createForPermissions(buildPermissions(roleName));
}

type AccountRow = {
  accountId: string;
  name: string;
  taxId: string | null;
  economicSector: string | null;
  address: string | null;
  website: string | null;
  isHighValue: boolean;
  createdAt: Date;
  updatedAt: Date;
  update: jest.Mock<Promise<AccountRow>, [Record<string, unknown>]>;
};

function fakeAccount(values: {
  accountId?: string;
  name?: string;
  isHighValue?: boolean;
}): AccountRow {
  const row: AccountRow = {
    accountId: values.accountId ?? '11111111-1111-4111-8111-111111111111',
    name: values.name ?? 'Acme',
    taxId: null,
    economicSector: null,
    address: null,
    website: null,
    isHighValue: values.isHighValue ?? false,
    createdAt: new Date('2026-10-18T12:00:00.000Z'),
    updatedAt: new Date('2026-10-18T12:00:00.000Z'),
    update: jest.fn((patch: Record<string, unknown>) => {
      Object.assign(row, patch);
      return Promise.resolve(row);
    }),
  };
  return row;
}

function buildService(initial: AccountRow[] = []) {
  const rows = [...initial];
  const accountModel = {
    findOne: jest.fn(() => Promise.resolve(null)),
    findByPk: jest.fn((id: string) =>
      Promise.resolve(rows.find((row) => row.accountId === id) ?? null),
    ),
    findAll: jest.fn(() => Promise.resolve(rows)),
    findAndCountAll: jest.fn(() =>
      Promise.resolve({ rows, count: rows.length }),
    ),
    create: jest.fn((values: { name: string; isHighValue?: boolean }) => {
      const row = fakeAccount({
        accountId: '22222222-2222-4222-8222-222222222222',
        name: values.name,
        isHighValue: values.isHighValue === true,
      });
      rows.push(row);
      return Promise.resolve(row);
    }),
  };
  const service = new AccountsService(
    accountModel as never,
    {} as never,
    {} as never,
  );
  return { service, accountModel };
}

describe('manage_high_value permission matrix', () => {
  it.each(['SoporteComercial', 'Admin'])(
    'REQ-02: %s receives manage_high_value once',
    (roleName) => {
      const rules = buildPermissions(roleName).filter(
        (rule) =>
          rule.action === HIGH_VALUE_RULE.action &&
          rule.subject === HIGH_VALUE_RULE.subject,
      );
      expect(rules).toEqual([HIGH_VALUE_RULE]);
    },
  );

  it('REQ-03: EjecutivoComercial can update Account and cannot manage high value', () => {
    const rules = buildPermissions('EjecutivoComercial');
    expect(rules).toEqual(
      expect.arrayContaining([
        { action: 'create', subject: 'Account' },
        { action: 'update', subject: 'Account' },
      ]),
    );
    expect(rules).not.toEqual(expect.arrayContaining([HIGH_VALUE_RULE]));
  });
});

describe('AccountsService high value', () => {
  it.each(['SoporteComercial', 'Admin'])(
    'REQ-02: %s creates and edits is_high_value',
    async (roleName) => {
      const { service } = buildService();
      const ability = abilityFor(roleName);

      const created = await service.createAccount(
        { name: 'Acme', is_high_value: true },
        ability,
      );
      expect(created.is_high_value).toBe(true);

      const updated = await service.updateAccount(
        created.account_id,
        { is_high_value: false },
        ability,
      );
      expect(updated.is_high_value).toBe(false);

      const marked = await service.updateAccount(
        created.account_id,
        { is_high_value: true },
        ability,
      );
      expect(marked.is_high_value).toBe(true);
    },
  );

  it('REQ-03: EjecutivoComercial sending true on create is 403 and writes nothing', async () => {
    const { service, accountModel } = buildService();

    await expect(
      service.createAccount(
        { name: 'Acme', is_high_value: true },
        abilityFor('EjecutivoComercial'),
      ),
    ).rejects.toMatchObject({ response: FORBIDDEN });
    expect(accountModel.create).not.toHaveBeenCalled();
    await expect(
      service.createAccount(
        { name: 'Acme', is_high_value: true },
        abilityFor('EjecutivoComercial'),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('REQ-03: EjecutivoComercial changing the flag on edit is 403 and keeps every field', async () => {
    const existing = fakeAccount({ name: 'Acme', isHighValue: false });
    const { service } = buildService([existing]);

    await expect(
      service.updateAccount(
        existing.accountId,
        { name: 'Otra', is_high_value: true },
        abilityFor('EjecutivoComercial'),
      ),
    ).rejects.toMatchObject({ response: FORBIDDEN });

    expect(existing.update).not.toHaveBeenCalled();
    expect(existing.name).toBe('Acme');
    expect(existing.isHighValue).toBe(false);
  });

  it('REQ-03: EjecutivoComercial can edit without sending the field', async () => {
    const existing = fakeAccount({ name: 'Acme', isHighValue: true });
    const { service } = buildService([existing]);

    const updated = await service.updateAccount(
      existing.accountId,
      { name: 'Otra' },
      abilityFor('EjecutivoComercial'),
    );

    expect(updated.name).toBe('Otra');
    expect(updated.is_high_value).toBe(true);
    const patch = existing.update.mock.calls[0][0];
    expect(patch).not.toHaveProperty('isHighValue');
  });

  it('REQ-01: omitting the field on create stores false', async () => {
    const { service } = buildService();
    const created = await service.createAccount(
      { name: 'Acme' },
      abilityFor('EjecutivoComercial'),
    );
    expect(created.is_high_value).toBe(false);
  });

  it('REQ-05: list and detail include is_high_value', async () => {
    const row = fakeAccount({ name: 'Acme', isHighValue: true });
    const { service } = buildService([row]);

    const list = await service.listAccounts({});
    const detail = await service.getAccount(row.accountId);

    expect(list.items[0]).toMatchObject({
      account_id: row.accountId,
      name: 'Acme',
      is_high_value: true,
    });
    expect(detail.is_high_value).toBe(true);
  });

  it('REQ-05: resolves a page of account ids in one query', async () => {
    const high = fakeAccount({
      accountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      isHighValue: true,
    });
    const { service, accountModel } = buildService([high]);
    accountModel.findAll.mockResolvedValue([high]);

    const flags = await service.findHighValueByAccountIds([
      high.accountId,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      high.accountId,
    ]);

    expect(accountModel.findAll).toHaveBeenCalledTimes(1);
    expect(flags.get(high.accountId)).toBe(true);
    expect(flags.has('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')).toBe(false);

    accountModel.findAll.mockClear();
    const empty = await service.findHighValueByAccountIds([]);
    expect(empty.size).toBe(0);
    expect(accountModel.findAll).not.toHaveBeenCalled();
  });
});

describe('Account high value audit', () => {
  const write = jest.fn().mockResolvedValue(undefined);
  const sequelize = new Sequelize({
    dialect: 'mysql',
    host: '127.0.0.1',
    username: 'unused',
    password: 'unused',
    database: 'unused',
    logging: false,
  });

  beforeAll(() => {
    try {
      sequelize.addModels([Account, Person]);
    } catch (error) {
      if (!Account.isInitialized) {
        throw error;
      }
    }
    new AuditHooksService(sequelize, { write } as never).onModuleInit();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('REQ-04: flipping is_high_value writes one audit_log UPDATE', async () => {
    write.mockClear();
    const account = Account.build({
      accountId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      name: 'Acme',
      isHighValue: false,
    });
    account.set('isHighValue', true);

    const hooks = Account as unknown as {
      runHooks: (name: string, instance: Account) => Promise<void>;
    };
    await hooks.runHooks('afterUpdate', account);

    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        tabla: 'accounts',
        registroId: account.accountId,
        accion: AuditAction.UPDATE,
        campoModificado: 'is_high_value',
        valorAnterior: JSON.stringify(false),
        valorNuevo: JSON.stringify(true),
      }),
    );
  });
});
