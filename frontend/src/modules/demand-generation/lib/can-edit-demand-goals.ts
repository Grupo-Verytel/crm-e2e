import type { MeResponse } from '../../auth/types';

type PermissionUser = Pick<MeResponse, 'permissions'> | null | undefined;

/** Gear visibility uses permissions, never the role name. */
export function canEditDemandGoals(user: PermissionUser): boolean {
  return Boolean(
    user?.permissions?.some(
      (permission) =>
        permission.subject === 'DemandGoal' &&
        (permission.action === 'create' || permission.action === 'update'),
    ),
  );
}
