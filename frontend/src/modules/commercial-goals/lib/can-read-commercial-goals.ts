import type { MeResponse } from '../../auth/types';

type PermissionUser = Pick<MeResponse, 'permissions'> | null | undefined;

export function hasCommercialGoalPermission(
  user: PermissionUser,
  action: 'create' | 'read' | 'update' | 'delete',
): boolean {
  return Boolean(
    user?.permissions?.some(
      (permission) =>
        permission.action === action && permission.subject === 'CommercialGoal',
    ),
  );
}
