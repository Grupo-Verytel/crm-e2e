import type { LoginCredentials, MeResponse } from '../types';

export type AuthContextValue = {
  user: MeResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};
