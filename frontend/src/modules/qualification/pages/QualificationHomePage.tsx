import { Navigate } from 'react-router-dom';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { isRoleName } from '../../../lib/roles';
import { useAuth } from '../../auth/hooks/useAuth';
import { RoutingInboxPage } from './RoutingInboxPage';

/**
 * Entry for /qualification — only SoporteComercial sees the routing inbox;
 * every other authenticated role stays in Calificación (assigned tray).
 */
export function QualificationHomePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isRoleName(user?.role_name, 'SoporteComercial')) {
    return <RoutingInboxPage />;
  }

  return <Navigate to="/qualification/assigned" replace />;
}

export default QualificationHomePage;
