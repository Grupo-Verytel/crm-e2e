import { Navigate } from 'react-router-dom';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { useAuth } from '../../auth/hooks/useAuth';
import { hasPermission } from '../../auth/lib/permission-catalog';
import { RoutingInboxPage } from './RoutingInboxPage';

/** Entry for /qualification — assigners see inbox; EjecutivoComercial goes to assigned. */
export function QualificationHomePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  const canAssign =
    user?.role_name === 'Admin' ||
    hasPermission(user?.permissions, 'assign', 'Sql');
  const canCreateOuv =
    user?.role_name === 'Admin' ||
    hasPermission(user?.permissions, 'create', 'Sql');

  if (canCreateOuv && !canAssign) {
    return <Navigate to="/qualification/assigned" replace />;
  }

  if (canAssign) {
    return <RoutingInboxPage />;
  }

  return <Navigate to="/opportunities" replace />;
}

export default QualificationHomePage;
