import { Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { LoadingScreen } from './components/LoadingScreen';
import { AuthProvider } from './modules/auth/context/AuthProvider';
import { NotificationsProvider } from './modules/auth/context/NotificationsProvider';
import { NotificationToast } from './modules/auth/components/NotificationToast';
import { AppRoutes } from './routing/AppRoutes';
import { PointerGlow } from './theme/PointerGlow';
import { ThemeProvider } from './theme/ThemeProvider';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <PointerGlow />
        <AuthProvider>
          <NotificationsProvider>
            <Suspense fallback={<LoadingScreen />}>
              <AppRoutes />
            </Suspense>
            <NotificationToast />
          </NotificationsProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
