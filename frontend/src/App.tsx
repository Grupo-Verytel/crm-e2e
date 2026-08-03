import { Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { LoadingScreen } from './components/LoadingScreen';
import { AuthProvider } from './modules/auth/context/AuthProvider';
import { AppRoutes } from './routing/AppRoutes';
import { PointerGlow } from './theme/PointerGlow';
import { ThemeProvider } from './theme/ThemeProvider';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <PointerGlow />
        <AuthProvider>
          <Suspense fallback={<LoadingScreen />}>
            <AppRoutes />
          </Suspense>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
