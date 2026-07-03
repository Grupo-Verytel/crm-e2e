import { lazy, type ReactNode } from 'react';
import { Navigate, useRoutes } from 'react-router-dom';
import { ProtectedRoute } from '../modules/auth/components/ProtectedRoute';
import { PublicRoute } from '../modules/auth/components/PublicRoute';
import { AdminRoute } from '../modules/auth/components/AdminRoute';
import { ModulePlaceholderPage } from '../modules/shared/pages/ModulePlaceholderPage';

const LoginPage = lazy(() => import('../modules/auth/pages/LoginPageLazy'));
const AdminUsersPage = lazy(() => import('../modules/auth/pages/AdminUsersPageLazy'));
const AuditLogPage = lazy(() => import('../modules/audit/pages/AuditLogPageLazy'));
const LeadsListPage = lazy(
  () => import('../modules/demand-generation/pages/LeadsListPageLazy'),
);
const LeadDetailPage = lazy(
  () => import('../modules/demand-generation/pages/LeadDetailPageLazy'),
);
const CampaignsListPage = lazy(
  () => import('../modules/demand-generation/pages/CampaignsListPageLazy'),
);
const CampaignFormPage = lazy(
  () => import('../modules/demand-generation/pages/CampaignFormPageLazy'),
);
const MqlInboxPage = lazy(
  () => import('../modules/demand-generation/pages/MqlInboxPageLazy'),
);
const MarketingDashboardPage = lazy(
  () => import('../modules/demand-generation/pages/MarketingDashboardPageLazy'),
);

function protectedElement(title: string, description: string) {
  return (
    <ProtectedRoute>
      <ModulePlaceholderPage title={title} description={description} />
    </ProtectedRoute>
  );
}

function adminElement(page: ReactNode) {
  return (
    <ProtectedRoute>
      <AdminRoute>{page}</AdminRoute>
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
      element: (
        <ProtectedRoute>
          <LeadsListPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/demand/leads/:id',
      element: (
        <ProtectedRoute>
          <LeadDetailPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/demand/campaigns',
      element: (
        <ProtectedRoute>
          <CampaignsListPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/demand/campaigns/new',
      element: (
        <ProtectedRoute>
          <CampaignFormPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/demand/mqls',
      element: (
        <ProtectedRoute>
          <MqlInboxPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/demand/dashboard',
      element: (
        <ProtectedRoute>
          <MarketingDashboardPage />
        </ProtectedRoute>
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
      element: adminElement(<AdminUsersPage />),
    },
    {
      path: '/admin/audit',
      element: adminElement(<AuditLogPage />),
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
