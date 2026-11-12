import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { KitchenDashboard } from './pages/KitchenDashboard';
import { ToastContainer } from './components/Toast';

export function App() {
  React.useEffect(() => {
    document.title = 'Kitchen Display - Arunachala Bhavan';
    let link = document.querySelector("link[rel*='icon']");
    if (link) {
      link.href = '/favicon.png?v=2';
      link.type = 'image/png';
    }
  }, []);

  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/" element={<KitchenDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
