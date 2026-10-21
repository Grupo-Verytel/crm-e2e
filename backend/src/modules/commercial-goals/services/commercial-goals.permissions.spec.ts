import { createRequire } from 'node:module';
import { ForbiddenException } from '@nestjs/common';
import { CHECK_ABILITY_KEY } from '../../auth/casl/check-ability.decorator';
import { CaslAbilityFactory } from '../../auth/casl/casl-ability.factory';
import { CaslGuard } from '../../auth/guards/casl.guard';
import { CommercialGoalsController } from '../controllers/commercial-goals.controller';

const nodeRequire = createRequire(__filename);
const { buildPermissions } = nodeRequire(
  '../../../../database/seeders/lib/role-permissions',
) as {
  buildPermissions: (roleName: string) => Array<{
    action: string;
    subject: string;
  }>;
};

const factory = new CaslAbilityFactory();

function contextFor(roleName: string) {
  const ability = factory.createForPermissions(buildPermissions(roleName));
  return {
    getHandler: () => function readCommercialGoal() {},
    getClass: () => CommercialGoalsController,
    switchToHttp: () => ({
      getRequest: () => ({ ability }),
    }),
  };
}

describe('CommercialGoal access', () => {
  const reflector = {
    getAllAndOverride: () => [{ action: 'read', subject: 'CommercialGoal' }],
  };
  const guard = new CaslGuard(reflector as never);

  it.each(['SoporteComercial', 'Admin'])(
    'REQ-07: %s can read CommercialGoal',
    (roleName) => {
      expect(guard.canActivate(contextFor(roleName) as never)).toBe(true);
    },
  );

  it.each(['EjecutivoComercial', 'Gerente Comercial', 'Preventa'])(
    'REQ-07: %s receives 403',
    (roleName) => {
      expect(() => guard.canActivate(contextFor(roleName) as never)).toThrow(
        ForbiddenException,
      );
    },
  );

  it('REQ-07: every route declares CheckAbility on CommercialGoal', () => {
    const proto = CommercialGoalsController.prototype as unknown as Record<
      string,
      unknown
    >;
    expect(Reflect.getMetadata(CHECK_ABILITY_KEY, proto.list)).toEqual([
      { action: 'read', subject: 'CommercialGoal' },
    ]);
    expect(Reflect.getMetadata(CHECK_ABILITY_KEY, proto.summary)).toEqual([
      { action: 'read', subject: 'CommercialGoal' },
    ]);
    expect(Reflect.getMetadata(CHECK_ABILITY_KEY, proto.getById)).toEqual([
      { action: 'read', subject: 'CommercialGoal' },
    ]);
    expect(Reflect.getMetadata(CHECK_ABILITY_KEY, proto.create)).toEqual([
      { action: 'create', subject: 'CommercialGoal' },
    ]);
    expect(Reflect.getMetadata(CHECK_ABILITY_KEY, proto.update)).toEqual([
      { action: 'update', subject: 'CommercialGoal' },
    ]);
    expect(Reflect.getMetadata(CHECK_ABILITY_KEY, proto.remove)).toEqual([
      { action: 'delete', subject: 'CommercialGoal' },
    ]);
  });
});
