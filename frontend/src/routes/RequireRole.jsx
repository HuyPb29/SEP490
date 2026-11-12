import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { F1Dialog } from '../components/F1Feedback';
import { messages } from '../api/f1Rules';
import { useAuth } from '../hooks/useAuth';

export function RequireAuth({ children }) {
  const location = useLocation();
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

export function RequireRole({ roles, selectedVenue = false, children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, selectedLocationId, roleHome } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && !roles.includes(user.role_code)) {
    return <F1Dialog message={messages.permission} onClose={() => navigate(roleHome[user.role_code] ?? '/', { replace: true })} />;
  }
  if (selectedVenue && user.role_code === 'owner' && !selectedLocationId) {
    return <Navigate to="/owner/workspace" replace />;
  }
  return children;
}
