import { createRequire } from 'node:module';
import { ForbiddenException } from '@nestjs/common';
import { CHECK_ABILITY_KEY } from '../../auth/casl/check-ability.decorator';
import { CaslAbilityFactory } from '../../auth/casl/casl-ability.factory';
import { CaslGuard } from '../../auth/guards/casl.guard';
import { CommercialReportsController } from '../controllers/commercial-reports.controller';

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
const REQUIRED = [{ action: 'read', subject: 'CommercialReport' }];

function contextFor(permissions: Array<{ action: string; subject: string }>) {
  const ability = factory.createForPermissions(permissions);
  return {
    getHandler: () => function readCommercialReport() {},
    getClass: () => CommercialReportsController,
    switchToHttp: () => ({
      getRequest: () => ({ ability }),
    }),
  };
}

describe('CommercialReport access', () => {
  const reflector = { getAllAndOverride: () => REQUIRED };
  const guard = new CaslGuard(reflector as never);

  it.each(['Admin', 'SoporteComercial'])(
    '%s can read CommercialReport from the seed matrix',
    (roleName) => {
      expect(
        guard.canActivate(contextFor(buildPermissions(roleName)) as never),
      ).toBe(true);
    },
  );

  it.each([
    'EjecutivoComercial',
    'Preventa',
    'ProductManager',
    'Gerente Comercial',
  ])('%s receives 403 without CommercialReport', (roleName) => {
    expect(() =>
      guard.canActivate(contextFor(buildPermissions(roleName)) as never),
    ).toThrow(ForbiddenException);
  });

  it('accepts the rule the Gerente Comercial migration writes', () => {
    expect(
      guard.canActivate(
        contextFor([{ action: 'read', subject: 'CommercialReport' }]) as never,
      ),
    ).toBe(true);
  });

  it('declares CheckAbility read CommercialReport on the three routes', () => {
    const proto = CommercialReportsController.prototype as unknown as Record<
      string,
      unknown
    >;
    expect(Reflect.getMetadata(CHECK_ABILITY_KEY, proto.getCommittee)).toEqual(
      REQUIRED,
    );
    expect(
      Reflect.getMetadata(CHECK_ABILITY_KEY, proto.getPipelineHealth),
    ).toEqual(REQUIRED);
    expect(Reflect.getMetadata(CHECK_ABILITY_KEY, proto.getDetails)).toEqual(
      REQUIRED,
    );
  });
});
