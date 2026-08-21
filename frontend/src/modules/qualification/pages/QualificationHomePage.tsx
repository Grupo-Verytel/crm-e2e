import { Navigate } from 'react-router-dom';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { useAuth } from '../../auth/hooks/useAuth';
import { RoutingInboxPage } from './RoutingInboxPage';

/** Entry for /qualification — Soporte sees inbox; Ejecutivo is sent to assigned. */
export function QualificationHomePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (user?.role_name === 'EjecutivoComercial') {
    return <Navigate to="/qualification/assigned" replace />;
  }

  if (
    user?.role_name === 'SoporteComercial' ||
    user?.role_name === 'Admin'
  ) {
    return <RoutingInboxPage />;
  }

  return <Navigate to="/opportunities" replace />;
}

export default QualificationHomePage;
