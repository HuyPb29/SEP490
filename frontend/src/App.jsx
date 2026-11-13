import { useEffect, useState } from 'react';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import api from './api';
import { messages } from './api/f1Rules';
import { clearSession, watchSessionExpiry } from './api/session';
import { F1Dialog } from './components/F1Feedback';
import { AuthProvider } from './contexts/AuthContext';
import { LocationProvider } from './contexts/LocationContext';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  return (
    <AuthProvider>
      <LocationProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </LocationProvider>
    </AuthProvider>
  );
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showExpiry, setShowExpiry] = useState(false);
  const returnTo =
    location.pathname === '/login'
      ? location.state?.returnTo
      : location.pathname + location.search;

  useEffect(() => {
    function expired() {
      setShowExpiry(true);
      navigate('/login', { replace: true, state: { returnTo } });
    }
    window.addEventListener('bms-session-expired', expired);
    const stop = watchSessionExpiry(() => {
      clearSession();
      expired();
    });
    return () => {
      stop();
      window.removeEventListener('bms-session-expired', expired);
    };
  }, [navigate, returnTo]);

  const [status, setStatus] = useState('checking...');

  useEffect(() => {
    api
      .get('/health')
      .then((res) => setStatus(res.data.status))
      .catch(() => setStatus('backend offline'));
  }, []);

  return (
    <>
      {showExpiry && location.pathname === '/login' && (
        <F1Dialog
          title="Phiên đăng nhập"
          message={messages.expiredSession}
          onClose={() => setShowExpiry(false)}
        />
      )}
      <div className="fixed bottom-3 right-3 text-[11px] font-mono text-slate-500 bg-white/80 backdrop-blur px-2 py-1 rounded shadow-sm border border-slate-200 z-50 pointer-events-none">
        BE: {status}
      </div>

      <AppRoutes />
    </>
  );
}
