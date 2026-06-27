import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchMe, loginRequest, logoutRequest } from '../api/auth-api';
import type { LoginCredentials, MeResponse } from '../types';
import { clearTokens, hasStoredSession } from '../../../lib/api/token-storage';
import { setSessionExpiredHandler } from '../../../lib/api/session-events';
import { AuthContext } from './auth-context';
import type { AuthContextValue } from './auth-context.types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    if (!hasStoredSession()) {
      setUser(null);
      return;
    }

    const profile = await fetchMe();
    setUser(profile);
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
    });

    return () => {
      setSessionExpiredHandler(null);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        if (hasStoredSession()) {
          const profile = await fetchMe();
          if (!cancelled) {
            setUser(profile);
          }
        }
      } catch {
        clearTokens();
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    await loginRequest(credentials);
    const profile = await fetchMe();
    setUser(profile);
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      logout,
      refreshSession,
    }),
    [user, isLoading, login, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
