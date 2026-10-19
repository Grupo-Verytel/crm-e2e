import type { MeResponse } from '../../auth/types';

type PermissionUser = Pick<MeResponse, 'permissions'> | null | undefined;

export function canManageHighValue(user: PermissionUser): boolean {
  return Boolean(
    user?.permissions?.some(
      (permission) =>
        permission.action === 'manage_high_value' &&
        permission.subject === 'Account',
    ),
  );
}
