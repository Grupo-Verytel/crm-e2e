import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { useAuth } from '../hooks/useAuth';

const ADMIN_ROLE = 'Admin';

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (user?.role_name !== ADMIN_ROLE) {
    return <Navigate to="/opportunities" replace />;
  }

  return children;
}
