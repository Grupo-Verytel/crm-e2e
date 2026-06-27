import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory } from './casl-ability.factory';
import { CaslGuard } from '../guards/casl.guard';
import { CHECK_ABILITY_KEY } from './check-ability.decorator';
import { AppAbility } from './casl-ability.factory';

describe('CaslGuard', () => {
  const factory = new CaslAbilityFactory();

  function buildContext(ability: AppAbility | undefined): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ ability }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;
  }

  it('EARS-AUTH-13: denies action when CASL permissions do not allow it', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([
        { action: 'create', subject: 'User' },
      ]),
    } as unknown as Reflector;

    const guard = new CaslGuard(reflector);
    const readOnlyAbility = factory.createForPermissions([
      { action: 'read', subject: 'Opportunity' },
    ]);

    expect(() => guard.canActivate(buildContext(readOnlyAbility))).toThrow(
      ForbiddenException,
    );
  });

  it('EARS-AUTH-13: allows action when CASL permissions grant it', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([
        { action: 'read', subject: 'Opportunity' },
      ]),
    } as unknown as Reflector;

    const guard = new CaslGuard(reflector);
    const ability = factory.createForPermissions([
      { action: 'read', subject: 'Opportunity' },
    ]);

    expect(guard.canActivate(buildContext(ability))).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      CHECK_ABILITY_KEY,
      expect.any(Array),
    );
  });
});
