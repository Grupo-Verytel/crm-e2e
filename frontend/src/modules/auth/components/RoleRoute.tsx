import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { isRoleName } from '../../../lib/roles';
import { useAuth } from '../hooks/useAuth';

export function RoleRoute({
  role,
  roles,
  children,
}: {
  role?: string;
  /** Any of these roles may access (Admin always allowed). */
  roles?: string[];
  children: ReactNode;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  const allowed = roles ?? (role ? [role] : []);
  const roleName = user?.role_name;
  if (isRoleName(roleName, 'Admin') || isRoleName(roleName, ...allowed)) {
    return children;
  }

  return <Navigate to="/opportunities" replace />;
}
