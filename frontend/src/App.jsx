import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import api from './api';

import FacilitySearchPage from './pages/location/FacilitySearchPage';
import FacilityDetailPage from './pages/location/FacilityDetailPage';

export default function App() {
  const [status, setStatus] = useState('checking...');

  useEffect(() => {
    api
      .get('/health')
      .then((res) => setStatus(res.data.status))
      .catch(() => setStatus('backend offline'));
  }, []);

  return (
    <BrowserRouter>
      {/* Floating backend health indicator */}
      <div className="fixed bottom-3 right-3 text-[11px] font-mono text-slate-500 bg-white/80 backdrop-blur px-2 py-1 rounded shadow-sm border border-slate-200 z-50 pointer-events-none">
        BE: {status}
      </div>

      <Routes>
        {/* UC11: Facility Search */}
        <Route path="/" element={<FacilitySearchPage />} />
        
        {/* UC12 & UC13: Facility Detail & Schedule */}
        <Route path="/facilities/:id" element={<FacilityDetailPage />} />
      </Routes>
    </BrowserRouter>
  );
}