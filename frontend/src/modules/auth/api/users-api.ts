import { apiRequest } from '../../../lib/api/http-client';
import { buildQueryString } from '../../../lib/format';
import type {
  CreateUserPayload,
  PaginatedUsers,
  UpdateUserPayload,
  User,
  UsersQuery,
} from '../types';

export async function fetchUsers(query: UsersQuery = {}): Promise<PaginatedUsers> {
  return apiRequest<PaginatedUsers>(`/users${buildQueryString(query)}`);
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  return apiRequest<User>('/users', {
    method: 'POST',
    body: payload,
  });
}

export async function updateUser(
  userId: string,
  payload: UpdateUserPayload,
): Promise<User> {
  return apiRequest<User>(`/users/${userId}`, {
    method: 'PUT',
    body: payload,
  });
}
