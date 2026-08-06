import { Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { LoadingScreen } from './components/LoadingScreen';
import { AuthProvider } from './modules/auth/context/AuthProvider';
import { NotificationsProvider } from './modules/auth/context/NotificationsProvider';
import { NotificationToast } from './modules/auth/components/NotificationToast';
import { AppRoutes } from './routing/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationsProvider>
          <Suspense fallback={<LoadingScreen />}>
            <AppRoutes />
          </Suspense>
          <NotificationToast />
        </NotificationsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
