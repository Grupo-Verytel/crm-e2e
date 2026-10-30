import type { MeResponse } from '../../auth/types';

type PermissionUser = Pick<MeResponse, 'permissions'> | null | undefined;

export function canManageDefaultAttendees(user: PermissionUser): boolean {
  return Boolean(
    user?.permissions?.some(
      (permission) =>
        permission.action === 'manage_default_attendees' &&
        permission.subject === 'DefaultMeetingAttendee',
    ),
  );
}
