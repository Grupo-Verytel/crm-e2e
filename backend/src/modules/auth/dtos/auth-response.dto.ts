export class AuthTokenResponseDto {
  access_token: string;
  refresh_token: string;
  expires_in: string;
}

export class MeResponseDto {
  user_id: string;
  email: string;
  full_name: string;
  role_id: string;
  role_name: string;
  is_active: boolean;
  last_login_at: Date | null;
}
