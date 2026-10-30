import { createRequire } from 'node:module';
import { ForbiddenException } from '@nestjs/common';
import { CHECK_ABILITY_KEY } from '../../auth/casl/check-ability.decorator';
import { CaslAbilityFactory } from '../../auth/casl/casl-ability.factory';
import { CaslGuard } from '../../auth/guards/casl.guard';
import { DashboardController } from '../controllers/dashboard.controller';

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
    getHandler: () => function demandGoal() {},
    getClass: () => DashboardController,
    switchToHttp: () => ({
      getRequest: () => ({ ability }),
    }),
  };
}

describe('DemandGoal access', () => {
  const guard = new CaslGuard({
    getAllAndOverride: () => [{ action: 'read', subject: 'DemandGoal' }],
  } as never);

  it.each(['DirectorMercadeo', 'Admin'])(
    'REQ-04: %s can read DemandGoal',
    (roleName) => {
      expect(guard.canActivate(contextFor(roleName) as never)).toBe(true);
    },
  );

  it.each(['GestorMercadeo', 'EjecutivoComercial', 'SoporteComercial'])(
    'REQ-04: %s receives 403 on DemandGoal',
    (roleName) => {
      expect(() => guard.canActivate(contextFor(roleName) as never)).toThrow(
        ForbiddenException,
      );
    },
  );

  it('REQ-04: read and delete routes declare DemandGoal', () => {
    const proto = DashboardController.prototype as unknown as Record<
      string,
      unknown
    >;
    expect(
      Reflect.getMetadata(CHECK_ABILITY_KEY, proto.marketingGoals),
    ).toEqual([{ action: 'read', subject: 'DemandGoal' }]);
    expect(
      Reflect.getMetadata(CHECK_ABILITY_KEY, proto.deleteMarketingGoal),
    ).toEqual([{ action: 'delete', subject: 'DemandGoal' }]);
    expect(buildPermissions('DirectorMercadeo')).toEqual(
      expect.arrayContaining([
        { action: 'create', subject: 'DemandGoal' },
        { action: 'read', subject: 'DemandGoal' },
        { action: 'update', subject: 'DemandGoal' },
        { action: 'delete', subject: 'DemandGoal' },
      ]),
    );
    expect(buildPermissions('GestorMercadeo')).not.toEqual(
      expect.arrayContaining([{ action: 'read', subject: 'DemandGoal' }]),
    );
  });

  it('PUT sets 201 when the batch creates rows', async () => {
    const response = { status: jest.fn() };
    const controller = new DashboardController({
      replaceMarketingGoals: () =>
        Promise.resolve({
          statusCode: 201,
          body: { fiscal_year: 2026, quarter: 2, items: [] },
        }),
    } as never);
    const body = await controller.replaceMarketingGoals(
      {
        fiscal_year: 2026,
        quarter: 2,
        goals: [],
      },
      { ability: undefined } as never,
      response as never,
    );
    expect(response.status).toHaveBeenCalledWith(201);
    expect(body.fiscal_year).toBe(2026);
  });
});
