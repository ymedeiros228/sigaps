import type React from 'react';
import { Suspense, lazy, useEffect, useMemo } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createAppTheme } from './theme';
import { useAuthStore, useAppStore } from './store';
import { LoginPage } from './pages/LoginPage';
import { AppLayout } from './components/layout/AppLayout';
import { useEnsureValidMunicipality } from './hooks/useEnsureValidMunicipality';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AjudaPage } from './components/common/AjudaPage';
import { MapSkeleton, PageSkeleton } from './components/common/PageSkeleton';
import { DashboardSkeleton } from './components/dashboard/DashboardSkeleton';

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const SigapsMap = lazy(() =>
  import('./components/map/SigapsMap').then((m) => ({ default: m.SigapsMap })),
);
const CadastrosPage = lazy(() =>
  import('./pages/CadastrosPage').then((m) => ({ default: m.CadastrosPage })),
);
const AdminPage = lazy(() =>
  import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })),
);

import { ensureDevAdminAuth, isDevAutoLoginEnabled } from './constants/devAuth';
import { cloudQueryRetryDelay, shouldRetryCloudQuery } from './utils/queryRetry';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 15 * 60_000,
      retry: (failureCount, error) => shouldRetryCloudQuery(failureCount, error),
      retryDelay: cloudQueryRetryDelay,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

function HomeRoute() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === 'ACS') return <Navigate to="/mapa" replace />;
  return (
    <ErrorBoundary title="Erro ao abrir o dashboard">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardPage />
      </Suspense>
    </ErrorBoundary>
  );
}

function AppLayoutWithMunicipality({ children }: { children: React.ReactNode }) {
  useEnsureValidMunicipality();
  return <>{children}</>;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <AppLayoutWithMunicipality>{children}</AppLayoutWithMunicipality>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route
          path="/dashboard"
          element={<HomeRoute />}
        />
        <Route
          path="/"
          element={<HomeRoute />}
        />
        <Route
          path="/mapa"
          element={
            <ErrorBoundary title="Erro ao abrir o mapa">
              <Suspense fallback={<MapSkeleton />}>
                <SigapsMap />
              </Suspense>
            </ErrorBoundary>
          }
        />
        <Route
          path="/cadastros"
          element={
            <ErrorBoundary title="Erro ao abrir cadastros">
              <Suspense fallback={<PageSkeleton />}>
                <CadastrosPage />
              </Suspense>
            </ErrorBoundary>
          }
        />
        <Route
          path="/admin"
          element={
            <ErrorBoundary title="Erro ao abrir administração">
              <Suspense fallback={<PageSkeleton />}>
                <AdminPage />
              </Suspense>
            </ErrorBoundary>
          }
        />
        <Route
          path="/ajuda"
          element={<AjudaPage />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const darkMode = useAppStore((s) => s.darkMode);
  const theme = useMemo(() => createAppTheme(darkMode), [darkMode]);

  useEffect(() => {
    hydrate();
    if (!isDevAutoLoginEnabled()) return;
    // A pré-carga dos dados (conforme o perfil) roda no AppLayout quando o token chega.
    void ensureDevAdminAuth(
      () => useAuthStore.getState(),
      useAuthStore.getState().setAuth,
      useAuthStore.getState().logout,
    );
  }, [hydrate]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <ErrorBoundary title="Erro ao abrir o aplicativo">
            <AppRoutes />
          </ErrorBoundary>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
