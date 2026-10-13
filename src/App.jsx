import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { KitchenDashboard } from './pages/KitchenDashboard';

export function App() {
  React.useEffect(() => {
    document.title = 'Kitchen Display - Arunachala Bhavan';
    let link = document.querySelector("link[rel*='icon']");
    if (link) {
      link.href = '/favicon.svg';
    }
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/" element={<KitchenDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
