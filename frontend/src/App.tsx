import type React from 'react';
import { Suspense, lazy, useEffect, useMemo } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline, Box, CircularProgress } from '@mui/material';
import { createAppTheme } from './theme';
import { useAuthStore, useAppStore } from './store';
import { LoginPage } from './pages/LoginPage';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AjudaHostingPage } from './components/common/HostingNotice';

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const SigapsMap = lazy(() =>
  import('./components/map/SigapsMap').then((m) => ({ default: m.SigapsMap })),
);
const CadastrosPage = lazy(() =>
  import('./pages/CadastrosPage').then((m) => ({ default: m.CadastrosPage })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
      <CircularProgress />
    </Box>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
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
          path="/"
          element={
            <Suspense fallback={<PageLoader />}>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route
          path="/mapa"
          element={
            <ErrorBoundary title="Erro ao abrir o mapa">
              <Suspense fallback={<PageLoader />}>
                <SigapsMap />
              </Suspense>
            </ErrorBoundary>
          }
        />
        <Route
          path="/cadastros"
          element={
            <Suspense fallback={<PageLoader />}>
              <CadastrosPage />
            </Suspense>
          }
        />
        <Route
          path="/ajuda"
          element={
            <Suspense fallback={<PageLoader />}>
              <AjudaHostingPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/mapa" replace />} />
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
  }, [hydrate]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
