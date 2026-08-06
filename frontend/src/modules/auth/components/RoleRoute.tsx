import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { useAuth } from '../hooks/useAuth';

export function RoleRoute({
  role,
  children,
}: {
  role: string;
  children: ReactNode;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (user?.role_name !== role && user?.role_name !== 'Admin') {
    return <Navigate to="/opportunities" replace />;
  }

  return children;
}
