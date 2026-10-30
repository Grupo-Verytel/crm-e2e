import { Role } from '../models/role.model';
import { UsersService } from './users.service';

describe('UsersService.findByEmail', () => {
  const user = {
    userId: 'user-1',
    email: 'ada@grupoverytel.com',
    fullName: 'Ada',
    roleId: 'role-1',
    isActive: false,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    role: { name: 'Admin' },
  };

  function build(found: typeof user | null = user) {
    const findOne = jest.fn().mockResolvedValue(found);
    const service = new UsersService(
      { findOne } as never,
      {} as never,
      {} as never,
    );
    return { service, findOne };
  }

  it('REQ-01: normalizes the email and returns an inactive live user', async () => {
    const { service, findOne } = build();
    const result = await service.findByEmail('  Ada@GrupoVerytel.com ');
    expect(findOne).toHaveBeenCalledWith({
      where: { email: 'ada@grupoverytel.com' },
      include: [Role],
    });
    expect(result).toMatchObject({
      user_id: 'user-1',
      is_active: false,
    });
  });

  it('REQ-01: returns null when the user is missing or soft-deleted', async () => {
    const { service, findOne } = build(null);
    await expect(service.findByEmail('nadie@grupoverytel.com')).resolves.toBeNull();
    expect(findOne).toHaveBeenCalled();
  });

  it('does not query when the email is blank', async () => {
    const { service, findOne } = build();
    await expect(service.findByEmail('   ')).resolves.toBeNull();
    expect(findOne).not.toHaveBeenCalled();
  });
});
