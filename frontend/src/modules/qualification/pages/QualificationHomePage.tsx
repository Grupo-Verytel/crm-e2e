import { Navigate } from 'react-router-dom';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { useAuth } from '../../auth/hooks/useAuth';
import { RoutingInboxPage } from './RoutingInboxPage';

const INBOX_ROLES = ['SoporteComercial', 'Admin', 'DirectorMercadeo'];

/** Entry for /qualification — Soporte/Director see inbox; Ejecutivo is sent to assigned. */
export function QualificationHomePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (user?.role_name === 'EjecutivoComercial') {
    return <Navigate to="/qualification/assigned" replace />;
  }

  if (user?.role_name && INBOX_ROLES.includes(user.role_name)) {
    return <RoutingInboxPage />;
  }

  return <Navigate to="/opportunities" replace />;
}

export default QualificationHomePage;
