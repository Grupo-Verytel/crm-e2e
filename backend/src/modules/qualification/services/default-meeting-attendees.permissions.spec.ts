import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ForbiddenException } from '@nestjs/common';
import { CHECK_ABILITY_KEY } from '../../auth/casl/check-ability.decorator';
import { CaslAbilityFactory } from '../../auth/casl/casl-ability.factory';
import { CaslGuard } from '../../auth/guards/casl.guard';
import { DefaultMeetingAttendeesController } from '../controllers/default-meeting-attendees.controller';

const nodeRequire = createRequire(__filename);
const { buildPermissions } = nodeRequire(
  '../../../../database/seeders/lib/role-permissions',
) as {
  buildPermissions: (roleName: string) => Array<{
    action: string;
    subject: string;
  }>;
};

const migration = nodeRequire(
  '../../../../database/migrations/20261029220200-default-meeting-attendee-permission.js',
) as {
  up: (queryInterface: { sequelize: { query: jest.Mock } }) => Promise<void>;
  down: (queryInterface: { sequelize: { query: jest.Mock } }) => Promise<void>;
};

const RULE = {
  action: 'manage_default_attendees',
  subject: 'DefaultMeetingAttendee',
};

const factory = new CaslAbilityFactory();

function contextFor(roleName: string) {
  const ability = factory.createForPermissions(buildPermissions(roleName));
  return {
    getHandler: () => function manageDefaultAttendees() {},
    getClass: () => DefaultMeetingAttendeesController,
    switchToHttp: () => ({
      getRequest: () => ({ ability }),
    }),
  };
}

function queryInterface(rows: Array<{ role_id: string; permissions: unknown }>) {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('UPDATE')) {
      return [[]];
    }
    return [rows];
  });
  return { sequelize: { query }, query };
}

describe('DefaultMeetingAttendee access', () => {
  const reflector = {
    getAllAndOverride: () => [RULE],
  };
  const guard = new CaslGuard(reflector as never);

  it('REQ-11: Admin can manage default attendees', () => {
    expect(guard.canActivate(contextFor('Admin') as never)).toBe(true);
    expect(buildPermissions('Admin')).toEqual(
      expect.arrayContaining([RULE]),
    );
  });

  it.each(['SoporteComercial', 'EjecutivoComercial', 'Gerente Comercial'])(
    'REQ-12: %s receives 403',
    (roleName) => {
      expect(buildPermissions(roleName)).not.toEqual(
        expect.arrayContaining([RULE]),
      );
      expect(() => guard.canActivate(contextFor(roleName) as never)).toThrow(
        ForbiddenException,
      );
    },
  );

  it('REQ-11: every admin route declares the same CheckAbility', () => {
    const proto = DefaultMeetingAttendeesController.prototype as unknown as Record<
      string,
      object
    >;
    for (const method of ['list', 'create', 'update', 'remove']) {
      expect(Reflect.getMetadata(CHECK_ABILITY_KEY, proto[method])).toEqual([
        RULE,
      ]);
    }
  });

  it('REQ-11: the migration adds the rule only to Admin and down removes only that rule', async () => {
    const source = readFileSync(
      join(
        __dirname,
        '../../../../database/migrations/20261029220200-default-meeting-attendee-permission.js',
      ),
      'utf8',
    );
    expect(source).toContain("name = 'Admin'");
    expect(source).not.toContain('Gerente Comercial');
    expect(source).not.toContain('SoporteComercial');

    const before = [{ action: 'read', subject: 'Opportunity' }];
    const db = queryInterface([
      { role_id: 'admin', permissions: JSON.stringify(before) },
    ]);
    await migration.up(db);
    const update = db.query.mock.calls.find((call) =>
      String(call[0]).includes('UPDATE'),
    );
    const next = JSON.parse(update?.[1].replacements.permissions) as Array<{
      action: string;
      subject: string;
    }>;
    expect(next).toEqual([...before, RULE]);

    const downDb = queryInterface([
      {
        role_id: 'admin',
        permissions: JSON.stringify([...before, RULE]),
      },
    ]);
    await migration.down(downDb);
    const downUpdate = downDb.query.mock.calls.find((call) =>
      String(call[0]).includes('UPDATE'),
    );
    expect(JSON.parse(downUpdate?.[1].replacements.permissions)).toEqual(before);
  });

  it('REQ-09: sql_cita_attendees cascades and is not paranoid', () => {
    const source = readFileSync(
      join(
        __dirname,
        '../../../../database/migrations/20261029220100-create-sql-cita-attendees.js',
      ),
      'utf8',
    );
    expect(source).toContain("onDelete: 'CASCADE'");
    expect(source).toContain('uq_sql_cita_attendees_cita_email');
    expect(source).not.toMatch(/deleted_at:\s*\{/);
  });
});
