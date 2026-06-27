import { apiRequest } from '../../../lib/api/http-client';
import { clearTokens, getRefreshToken, setTokens } from '../../../lib/api/token-storage';
import type {
  AuthTokenResponse,
  LoginCredentials,
  MeResponse,
} from '../types';

export async function loginRequest(
  credentials: LoginCredentials,
): Promise<AuthTokenResponse> {
  const tokens = await apiRequest<AuthTokenResponse>('/auth/login', {
    method: 'POST',
    body: credentials,
    auth: false,
  });

  setTokens(tokens.access_token, tokens.refresh_token);
  return tokens;
}

export async function fetchMe(): Promise<MeResponse> {
  return apiRequest<MeResponse>('/auth/me');
}

export async function logoutRequest(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      await apiRequest<{ message: string }>('/auth/logout', {
        method: 'POST',
        body: { refresh_token: refreshToken },
      });
    } catch {
      // Clear local session even if the server call fails.
    }
  }
  clearTokens();
}
