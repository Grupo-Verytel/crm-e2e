import { apiRequest } from '../../../lib/api/http-client';
import type { Role, UpdateRolePayload } from '../types';

export async function fetchRoles(): Promise<Role[]> {
  return apiRequest<Role[]>('/roles');
}

export async function updateRole(
  roleId: string,
  payload: UpdateRolePayload,
): Promise<Role> {
  return apiRequest<Role>(`/roles/${roleId}`, {
    method: 'PUT',
    body: payload,
  });
}
