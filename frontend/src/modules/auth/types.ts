export type AuthTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: string;
};

export type MeResponse = {
  user_id: string;
  email: string;
  full_name: string;
  role_id: string;
  role_name: string;
  is_active: boolean;
  last_login_at: string | null;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type CaslPermissionRule = {
  action: string;
  subject: string;
  conditions?: Record<string, unknown>;
};

export type User = {
  user_id: string;
  email: string;
  full_name: string;
  role_id: string;
  role_name: string;
  is_active: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PaginatedUsers = {
  items: User[];
  total: number;
  page: number;
  limit: number;
};

export type CreateUserPayload = {
  email: string;
  password: string;
  full_name: string;
  role_id: string;
  is_active?: boolean;
};

export type UpdateUserPayload = {
  email?: string;
  password?: string;
  full_name?: string;
  role_id?: string;
  is_active?: boolean;
};

export type Role = {
  role_id: string;
  name: string;
  description: string | null;
  permissions: CaslPermissionRule[];
  is_system: boolean;
};

export type UpdateRolePayload = {
  description?: string;
  permissions: CaslPermissionRule[];
};

export type UsersQuery = {
  page?: number;
  limit?: number;
};

export type ApiErrorBody = {
  code?: string;
  message?: string | string[];
  statusCode?: number;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}
