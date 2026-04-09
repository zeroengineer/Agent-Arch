import { Routes, Route, Navigate, useNavigate } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { queryClient } from './lib/queryClient';
import { useEffect, useState } from 'react';
import { api } from './lib/api';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProjectPage from './pages/ProjectPage';

// Simple Auth Provider state
export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check session on mount
    api.get('auth/session').json().then((data: any) => {
      setIsAuthenticated(!!(data && data.session));
    }).catch(() => {
      setIsAuthenticated(false);
    });
  }, []);

  if (isAuthenticated === null) {
      return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage onLogin={() => setIsAuthenticated(true)} />
        } />
        <Route path="/dashboard" element={
          isAuthenticated ? <DashboardPage /> : <Navigate to="/login" />
        } />
        <Route path="/project/:id" element={
          isAuthenticated ? <ProjectPage /> : <Navigate to="/login" />
        } />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </QueryClientProvider>
  );
}
