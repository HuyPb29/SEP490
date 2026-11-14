import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import '../../pages/workspace.css';
import AdminLayout from './AdminLayout';
import ManagementLayout from './ManagementLayout';
import PublicLayout, { PublicHeader } from './PublicLayout';

export function WorkspaceHeader({ user }) {
  return <PublicHeader user={user} />;
}

export default function WorkspaceLayout({
  role,
  title,
  description,
  subtitle,
  actions,
  backTo,
  locations,
  locationId,
  onLocationChange,
  children,
}) {
  const location = useLocation();
  const { user, roleHome } = useAuth();

  if (!user) {
    return <Navigate to="/login" state={{ returnTo: location.pathname + location.search }} replace />;
  }

  const userRole = String(user.role_code || user.role || '').toLowerCase();
  if (role && userRole !== role) {
    return <Navigate to={roleHome?.[userRole] ?? '/'} replace />;
  }

  const effectiveRole = role || userRole;
  const resolvedSubtitle = subtitle || description;

  if (effectiveRole === 'admin') {
    return (
      <AdminLayout title={title} subtitle={resolvedSubtitle} actions={actions} backTo={backTo}>
        <div className="cw-stack">{children}</div>
      </AdminLayout>
    );
  }

  if (effectiveRole === 'owner' || effectiveRole === 'staff') {
    return (
      <ManagementLayout
        role={role}
        title={title}
        subtitle={resolvedSubtitle}
        actions={actions}
        backTo={backTo}
        locations={locations}
        locationId={locationId}
        onLocationChange={onLocationChange}
      >
        <div className="cw-stack">{children}</div>
      </ManagementLayout>
    );
  }

  return (
    <PublicLayout title={title} subtitle={resolvedSubtitle} actions={actions} backTo={backTo}>
      <div className="cw-stack">{children}</div>
    </PublicLayout>
  );
}
