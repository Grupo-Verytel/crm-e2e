import { CaslAbilityFactory } from './casl-ability.factory';

describe('CaslAbilityFactory', () => {
  const factory = new CaslAbilityFactory();

  it('EARS-AUTH-14: evaluates permission conditions before allowing action', () => {
    const ability = factory.createForPermissions([
      {
        action: 'read',
        subject: 'Opportunity',
        conditions: { responsable_id: 'user-123' },
      },
    ]);

    expect(ability.can('read', 'Opportunity')).toBe(true);
    expect(ability.can('update', 'Opportunity')).toBe(false);
  });
});
