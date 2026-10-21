import { createRequire } from 'node:module';
import { Op } from 'sequelize';
import { AuthService } from '../services/auth.service';
import { UsersService } from '../services/users.service';
import {
  ASSIGNABLE_COMMERCIAL_ROLE_NAMES,
  GERENTE_COMERCIAL_ROLE_NAME,
  canCreateDirectOuv,
  ouvBoardDefault,
} from './commercial-roles';

const nodeRequire = createRequire(__filename);
const migration = nodeRequire(
  '../../../../database/migrations/20261020120000-gerente-comercial-manage-high-value.js',
) as {
  up: (queryInterface: { sequelize: { query: jest.Mock } }) => Promise<void>;
  down: (queryInterface: { sequelize: { query: jest.Mock } }) => Promise<void>;
};

const HIGH_VALUE = { action: 'manage_high_value', subject: 'Account' };

describe('commercial role helpers', () => {
  it('Q1: only Gerente Comercial defaults the board to own OUVs', () => {
    expect(ouvBoardDefault(GERENTE_COMERCIAL_ROLE_NAME)).toBe('own');
    expect(ouvBoardDefault('SoporteComercial')).toBe('all');
    expect(ouvBoardDefault('EjecutivoComercial')).toBe('all');
    expect(ouvBoardDefault('Admin')).toBe('all');
  });

  it('can_create_direct_ouv is true for Ejecutivo and Gerente only', () => {
    expect(canCreateDirectOuv(GERENTE_COMERCIAL_ROLE_NAME)).toBe(true);
    expect(canCreateDirectOuv('EjecutivoComercial')).toBe(true);
    expect(canCreateDirectOuv('SoporteComercial')).toBe(false);
    expect(canCreateDirectOuv('Admin')).toBe(false);
  });
});

describe('GET /auth/me commercial fields', () => {
  function serviceFor(roleName: string) {
    const userModel = {
      findByPk: jest.fn().mockResolvedValue({
        userId: 'user-1',
        email: 'ana@example.com',
        fullName: 'Ana',
        roleId: 'role-1',
        isActive: true,
        lastLoginAt: null,
        role: { name: roleName, permissions: [] },
      }),
    };
    return new AuthService(
      userModel as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  it('REQ-04: Gerente Comercial receives own and can create a direct OUV', async () => {
    const me = await serviceFor(GERENTE_COMERCIAL_ROLE_NAME).getMe('user-1');
    expect(me.ouv_board_default).toBe('own');
    expect(me.can_create_direct_ouv).toBe(true);
  });

  it('Soporte receives all and cannot create a direct OUV', async () => {
    const me = await serviceFor('SoporteComercial').getMe('user-1');
    expect(me.ouv_board_default).toBe('all');
    expect(me.can_create_direct_ouv).toBe(false);
  });
});

describe('findActiveByRoleNames', () => {
  it('lists active users of both commercial roles in one query', async () => {
    const findAll = jest.fn().mockResolvedValue([]);
    const service = new UsersService(
      { findAll } as never,
      {} as never,
      {} as never,
    );

    await service.findActiveByRoleNames(ASSIGNABLE_COMMERCIAL_ROLE_NAMES);

    expect(findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        order: [['fullName', 'ASC']],
        include: [
          expect.objectContaining({
            where: { name: { [Op.in]: [...ASSIGNABLE_COMMERCIAL_ROLE_NAMES] } },
            required: true,
          }),
        ],
      }),
    );
  });
});

describe('Gerente Comercial manage_high_value migration', () => {
  const before = [
    { action: 'read', subject: 'Opportunity' },
    { action: 'update', subject: 'Account' },
  ];

  function queryInterface(
    rows: Array<{ role_id: string; permissions: unknown }>,
  ) {
    const query = jest.fn().mockResolvedValue([rows]);
    return { sequelize: { query }, query };
  }

  it('REQ-01: adds only manage_high_value and keeps the previous rules', async () => {
    const db = queryInterface([
      { role_id: 'role-gerente', permissions: JSON.stringify(before) },
    ]);

    await migration.up(db);

    const calls = db.query.mock.calls as Array<
      [string, { replacements: { permissions: string } }]
    >;
    const next = JSON.parse(calls[1][1].replacements.permissions) as Array<{
      action: string;
      subject: string;
    }>;
    expect(next.slice(0, before.length)).toEqual(before);
    expect(next).toContainEqual(HIGH_VALUE);
    expect(
      next.filter((rule) => rule.action === HIGH_VALUE.action),
    ).toHaveLength(1);
  });

  it('is re-runnable and does not duplicate the rule', async () => {
    const db = queryInterface([
      {
        role_id: 'role-gerente',
        permissions: [...before, HIGH_VALUE],
      },
    ]);

    await migration.up(db);

    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('does not fail when the role row is missing', async () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const db = queryInterface([]);

    await expect(migration.up(db)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('down removes only manage_high_value', async () => {
    const db = queryInterface([
      {
        role_id: 'role-gerente',
        permissions: [...before, HIGH_VALUE],
      },
    ]);

    await migration.down(db);

    const calls = db.query.mock.calls as Array<
      [string, { replacements: { permissions: string } }]
    >;
    expect(JSON.parse(calls[1][1].replacements.permissions)).toEqual(before);
  });
});
