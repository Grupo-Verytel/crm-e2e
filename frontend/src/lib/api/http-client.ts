import type { ApiErrorBody, AuthTokenResponse } from '../../modules/auth/types';
import { ApiError } from '../../modules/auth/types';
import { notifySessionExpired } from './session-events';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from './token-storage';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  retry?: boolean;
};

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    clearTokens();
    return null;
  }

  const tokens = (await response.json()) as AuthTokenResponse;
  setTokens(tokens.access_token, tokens.refresh_token);
  return tokens.access_token;
}

async function getValidAccessToken(retry: boolean): Promise<string | null> {
  const accessToken = getAccessToken();
  if (accessToken) {
    return accessToken;
  }

  if (!retry) {
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, auth = true, retry = true } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const accessToken = await getValidAccessToken(retry);
    if (!accessToken) {
      notifySessionExpired();
      throw new ApiError(401, 'Session expired');
    }
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && auth && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiRequest<T>(path, { ...options, retry: false });
    }
    clearTokens();
    notifySessionExpired();
    throw new ApiError(401, 'Session expired');
  }

  if (!response.ok) {
    let message = response.statusText || 'Request failed';
    let code: string | undefined;

    try {
      const body = (await response.json()) as ApiErrorBody;
      code = body.code;
      if (Array.isArray(body.message)) {
        message = body.message.join(', ');
      } else if (typeof body.message === 'string') {
        message = body.message;
      }
    } catch {
      // ignore parse errors
    }

    throw new ApiError(response.status, message, code);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export { API_BASE };
