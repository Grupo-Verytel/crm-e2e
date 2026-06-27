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
