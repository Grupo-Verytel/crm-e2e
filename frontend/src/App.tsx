import { Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { LoadingScreen } from './components/LoadingScreen';
import { AuthProvider } from './modules/auth/context/AuthProvider';
import { AppRoutes } from './routing/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<LoadingScreen />}>
          <AppRoutes />
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
