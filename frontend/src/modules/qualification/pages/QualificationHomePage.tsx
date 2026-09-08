import { Navigate } from 'react-router-dom';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { isRoleName } from '../../../lib/roles';
import { useAuth } from '../../auth/hooks/useAuth';
import { RoutingInboxPage } from './RoutingInboxPage';

const INBOX_ROLES = ['SoporteComercial', 'Admin', 'DirectorMercadeo'] as const;

/**
 * Entry for /qualification — Soporte/Director see inbox;
 * every other authenticated role stays in Calificación (assigned tray).
 */
export function QualificationHomePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isRoleName(user?.role_name, ...INBOX_ROLES)) {
    return <RoutingInboxPage />;
  }

  return <Navigate to="/qualification/assigned" replace />;
}

export default QualificationHomePage;
