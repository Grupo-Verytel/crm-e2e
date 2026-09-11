import { apiRequest } from '../../../lib/api/http-client';
import type { CreateRolePayload, Role, UpdateRolePayload } from '../types';

export async function fetchRoles(): Promise<Role[]> {
  return apiRequest<Role[]>('/roles');
}

export async function createRole(payload: CreateRolePayload): Promise<Role> {
  return apiRequest<Role>('/roles', {
    method: 'POST',
    body: payload,
  });
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
