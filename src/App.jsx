import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { KitchenDashboard } from './pages/KitchenDashboard';
import { ToastContainer } from './components/Toast';
import { AuthGuard } from './components/AuthGuard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { STAFF_ROLES } from './services/authService';

export function App() {
  React.useEffect(() => {
    document.title = 'Kitchen Display - Arunachala Bhavan';
    let link = document.querySelector("link[rel='icon'][sizes='192x192']") || document.querySelector("link[rel='icon']");
    if (link) {
      link.href = '/icon-192.png?v=3';
      link.type = 'image/png';
    }
  }, []);

  return (
    <ErrorBoundary>
      <AuthGuard requiredRole={STAFF_ROLES.KITCHEN} appTitle="Kitchen Display System — Arunachala Bhavan">
        <BrowserRouter>
          <ToastContainer />
          <Routes>
            <Route path="/" element={<KitchenDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthGuard>
    </ErrorBoundary>
  );
}

export default App;
