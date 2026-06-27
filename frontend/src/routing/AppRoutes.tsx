import { lazy } from 'react';
import { Navigate, useRoutes } from 'react-router-dom';
import { ProtectedRoute } from '../modules/auth/components/ProtectedRoute';
import { PublicRoute } from '../modules/auth/components/PublicRoute';
import { ModulePlaceholderPage } from '../modules/shared/pages/ModulePlaceholderPage';

const LoginPage = lazy(() => import('../modules/auth/pages/LoginPageLazy'));

function protectedElement(title: string, description: string) {
  return (
    <ProtectedRoute>
      <ModulePlaceholderPage title={title} description={description} />
    </ProtectedRoute>
  );
}

export function AppRoutes() {
  return useRoutes([
    {
      path: '/',
      element: (
        <ProtectedRoute>
          <Navigate to="/opportunities" replace />
        </ProtectedRoute>
      ),
    },
    {
      path: '/login',
      element: (
        <PublicRoute>
          <LoginPage />
        </PublicRoute>
      ),
    },
    {
      path: '/opportunities',
      element: protectedElement(
        'Oportunidades (OUV)',
        'Pipeline de oportunidades — módulo discovery (próximamente).',
      ),
    },
    {
      path: '/demand',
      element: protectedElement(
        'Generación de demanda',
        'Leads y campañas — módulo demand-generation (próximamente).',
      ),
    },
    {
      path: '/qualification',
      element: protectedElement(
        'Calificación',
        'Nurturing y scoring — módulo qualification (próximamente).',
      ),
    },
    {
      path: '/presales',
      element: protectedElement(
        'Preventa (PRE)',
        'Actividades Preventa — módulo technical-feasibility (próximamente).',
      ),
    },
    {
      path: '/pricing',
      element: protectedElement(
        'Pricing (PRI)',
        'Análisis de margen — módulo pricing (próximamente).',
      ),
    },
    {
      path: '/offers',
      element: protectedElement(
        'Oferta & Cierre',
        'Propuestas y contratos — módulo offer-closing (próximamente).',
      ),
    },
    {
      path: '/services',
      element: protectedElement(
        'Implementación (SER)',
        'Servicios y hitos RFS/RFB — módulo implementation (próximamente).',
      ),
    },
    {
      path: '/after-sales',
      element: protectedElement(
        'Posventa',
        'Renovaciones y ChurnRate — módulo post-sales (próximamente).',
      ),
    },
    {
      path: '/admin/users',
      element: protectedElement(
        'Usuarios y roles',
        'Gestión de usuarios y permisos — módulo auth (próximamente).',
      ),
    },
    {
      path: '/admin/audit',
      element: protectedElement(
        'Auditoría',
        'Consulta de audit_log — módulo audit (próximamente).',
      ),
    },
    {
      path: '*',
      element: protectedElement(
        'No encontrado',
        'La ruta solicitada no existe. Usa el menú lateral para navegar.',
      ),
    },
  ]);
}
